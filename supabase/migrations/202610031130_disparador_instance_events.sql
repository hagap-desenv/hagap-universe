-- Disparador (QA Q5): alerta de queda. Eventos de conexão/queda por instância (leitura por membros da igreja,
-- escrita só pelo motor). set_instance_status regista 'disconnected' (open → disconnected) e 'connected' (→ open).
-- instance_overview passa a expor down_since: queda mais recente que a última conexão (null = sem alerta).

create table disparador.instance_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  instance_id uuid not null,
  kind text not null constraint instance_events_kind check (kind in ('connected', 'disconnected')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (instance_id, tenant_id) references disparador.instances (id, tenant_id) on delete cascade
);
create index instance_events_instance_idx on disparador.instance_events (instance_id, created_at desc);

alter table disparador.instance_events enable row level security;
revoke all on disparador.instance_events from public, anon, authenticated;
grant select on disparador.instance_events to authenticated;
grant all on disparador.instance_events to service_role;

create policy instance_events_select on disparador.instance_events for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));

create or replace function disparador.set_instance_status(p_instance_id uuid, p_status disparador.instance_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old disparador.instance_status;
  v_tenant uuid;
begin
  if not disparador.is_engine() then
    raise exception 'só o motor altera o estado da instância' using errcode = '42501';
  end if;

  select status, tenant_id into v_old, v_tenant from disparador.instances where id = p_instance_id for update;
  if not found then
    return;
  end if;

  update disparador.instances set status = p_status where id = p_instance_id;

  if v_old = 'open' and p_status = 'disconnected' then
    insert into disparador.instance_events (tenant_id, instance_id, kind, detail)
    values (v_tenant, p_instance_id, 'disconnected', jsonb_build_object('from', v_old));
  elsif p_status = 'open' and v_old <> 'open' then
    insert into disparador.instance_events (tenant_id, instance_id, kind, detail)
    values (v_tenant, p_instance_id, 'connected', jsonb_build_object('from', v_old));
  end if;
end;
$$;

-- Novo campo no retorno → recriar (assinatura de entrada inalterada)
drop function disparador.instance_overview(uuid);
create function disparador.instance_overview(p_tenant_id uuid)
returns table (
  id uuid,
  name text,
  phone_e164 text,
  status disparador.instance_status,
  daily_cap int,
  sent_today int,
  queued bigint,
  sending bigint,
  sent bigint,
  failed bigint,
  deferred bigint,
  has_webhook_key boolean,
  down_since timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    i.id, i.name, i.phone_e164, i.status, i.daily_cap,
    coalesce((
      select u.sent from disparador.daily_usage u
      where u.instance_id = i.id and u.day = (now() at time zone t.timezone)::date
    ), 0) as sent_today,
    count(m.id) filter (where m.status = 'queued') as queued,
    count(m.id) filter (where m.status = 'sending') as sending,
    count(m.id) filter (where m.status = 'sent') as sent,
    count(m.id) filter (where m.status = 'failed') as failed,
    count(m.id) filter (where m.status = 'deferred') as deferred,
    i.webhook_key_hash is not null as has_webhook_key,
    (
      select d.created_at from disparador.instance_events d
      where d.instance_id = i.id and d.kind = 'disconnected'
        and d.created_at > coalesce((
          select max(c.created_at) from disparador.instance_events c
          where c.instance_id = i.id and c.kind = 'connected'
        ), '-infinity'::timestamptz)
      order by d.created_at desc
      limit 1
    ) as down_since
  from disparador.instances i
  join public.tenants t on t.id = i.tenant_id
  left join disparador.outbound_messages m on m.instance_id = i.id
  where i.tenant_id = p_tenant_id
  group by i.id, t.timezone
  order by i.name;
$$;

revoke execute on function disparador.instance_overview(uuid) from public, anon;
grant execute on function disparador.instance_overview(uuid) to authenticated;
