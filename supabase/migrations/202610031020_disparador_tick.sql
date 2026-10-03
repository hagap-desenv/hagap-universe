-- Disparador: suporte ao tick (EF disparador-tick via pg_cron). Tudo engine-only (service_role).

-- Heartbeat dos jobs do motor: RLS ativa e sem policies → só service_role / funções do motor
create table disparador.heartbeats (
  job text primary key,
  last_run_at timestamptz not null default now(),
  last_status text not null,
  detail jsonb not null default '{}'::jsonb
);
alter table disparador.heartbeats enable row level security;
revoke all on disparador.heartbeats from public, anon, authenticated;
grant all on disparador.heartbeats to service_role;

create or replace function disparador.touch_heartbeat(p_job text, p_status text, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not disparador.is_engine() then
    raise exception 'só o motor grava heartbeat' using errcode = '42501';
  end if;
  insert into disparador.heartbeats (job, last_run_at, last_status, detail)
  values (p_job, now(), p_status, coalesce(p_detail, '{}'::jsonb))
  on conflict (job) do update
    set last_run_at = excluded.last_run_at, last_status = excluded.last_status, detail = excluded.detail;
end;
$$;

-- Estado da instância visto pelo health-check do motor (ex.: connectionState ≠ open → disconnected)
create or replace function disparador.set_instance_status(p_instance_id uuid, p_status disparador.instance_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not disparador.is_engine() then
    raise exception 'só o motor altera o estado da instância' using errcode = '42501';
  end if;
  update disparador.instances set status = p_status where id = p_instance_id;
end;
$$;

-- Instâncias com algo a enviar agora: open, intervalo cumprido e mensagens queued vencidas.
-- (Janela local e cap diário continuam a ser decididos por claim_next.)
create or replace function disparador.list_dispatchable_instances()
returns table (instance_id uuid, instance_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not disparador.is_engine() then
    raise exception 'só o motor lista instâncias para envio' using errcode = '42501';
  end if;
  return query
    select i.id, i.name
    from disparador.instances i
    where i.status = 'open'
      and i.next_allowed_at <= now()
      and exists (
        select 1 from disparador.outbound_messages m
        where m.instance_id = i.id and m.status = 'queued' and m.not_before <= now()
      )
    order by i.next_allowed_at;
end;
$$;

revoke execute on function disparador.touch_heartbeat(text, text, jsonb) from public, anon, authenticated;
revoke execute on function disparador.set_instance_status(uuid, disparador.instance_status) from public, anon, authenticated;
revoke execute on function disparador.list_dispatchable_instances() from public, anon, authenticated;

grant execute on function disparador.touch_heartbeat(text, text, jsonb) to service_role;
grant execute on function disparador.set_instance_status(uuid, disparador.instance_status) to service_role;
grant execute on function disparador.list_dispatchable_instances() to service_role;
