-- Disparador: grupos de contatos (listas da igreja; não são grupos do WhatsApp) e envio para grupo.
-- Envio para grupo = campanha com UMA mensagem individual e personalizada por membro, sempre via
-- enqueue_message (regras anti-ban num só lugar): só opt-in recebe; opt-out e sem opt-in são contados.

-- FK composta (contato, igreja) para membros: exige chave única (id, tenant_id) em contacts
alter table disparador.contacts add constraint contacts_id_tenant_key unique (id, tenant_id);

create table disparador.contact_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null constraint contact_groups_name_not_blank check (btrim(name) <> ''),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (id, tenant_id)
);

-- Membro = vínculo grupo↔contato da MESMA igreja (garantido pelas duas FKs compostas)
create table disparador.contact_group_members (
  tenant_id uuid not null,
  group_id uuid not null,
  contact_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (group_id, contact_id),
  foreign key (group_id, tenant_id) references disparador.contact_groups (id, tenant_id) on delete cascade,
  foreign key (contact_id, tenant_id) references disparador.contacts (id, tenant_id) on delete cascade
);
create index contact_group_members_contact_idx on disparador.contact_group_members (contact_id);

create trigger contact_groups_updated_at before update on disparador.contact_groups
  for each row execute function public.set_updated_at();

-- Campanha de grupo: de onde veio e o que foi ignorado (o resumo continua visível no acompanhamento)
alter table disparador.campaigns
  add column contact_group_id uuid,
  add column instance_id uuid,
  add column enqueued int not null default 0,
  add column skipped_no_optin int not null default 0,
  add column skipped_optout int not null default 0,
  add column skipped_other int not null default 0,
  add constraint campaigns_contact_group_fk foreign key (contact_group_id, tenant_id)
    references disparador.contact_groups (id, tenant_id) on delete set null (contact_group_id),
  add constraint campaigns_instance_fk foreign key (instance_id, tenant_id)
    references disparador.instances (id, tenant_id) on delete set null (instance_id);
create index campaigns_contact_group_idx on disparador.campaigns (contact_group_id, created_at desc);

-- ===== Permissões e RLS =====
grant select on disparador.contact_groups, disparador.contact_group_members to authenticated;
grant insert, delete on disparador.contact_groups, disparador.contact_group_members to authenticated;
grant update (name, description) on disparador.contact_groups to authenticated;
grant all on disparador.contact_groups, disparador.contact_group_members to service_role;

alter table disparador.contact_groups enable row level security;
alter table disparador.contact_group_members enable row level security;

create policy contact_groups_select on disparador.contact_groups for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));
create policy contact_groups_write on disparador.contact_groups for all to authenticated
  using (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]))
  with check (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]));

create policy contact_group_members_select on disparador.contact_group_members for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));
create policy contact_group_members_write on disparador.contact_group_members for all to authenticated
  using (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]))
  with check (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]));

-- ===== Adicionar número ao grupo (popup): cria o contato se não existir na igreja; se existir, só vincula.
-- SECURITY INVOKER → policies de contacts/membros valem (admin/coordenador). Nunca altera contato existente.
create or replace function disparador.add_group_member(p_group_id uuid, p_name text, p_phone_e164 text, p_opt_in boolean)
returns table (contact_id uuid, existed boolean)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_contact uuid;
  v_existed boolean := false;
begin
  select g.tenant_id into v_tenant from disparador.contact_groups g where g.id = p_group_id;
  if v_tenant is null then
    raise exception 'sem permissão para este grupo' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'nome é obrigatório' using errcode = '22023';
  end if;
  if p_phone_e164 is null or p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'telefone deve estar em E.164' using errcode = '22023';
  end if;

  select c.id into v_contact from disparador.contacts c
  where c.tenant_id = v_tenant and c.phone_e164 = p_phone_e164;

  if v_contact is null then
    insert into disparador.contacts (tenant_id, phone_e164, name, opted_in_at, source)
    values (v_tenant, p_phone_e164, btrim(p_name), case when p_opt_in then now() end, 'grupo')
    returning id into v_contact;
  else
    v_existed := true;
  end if;

  insert into disparador.contact_group_members (tenant_id, group_id, contact_id)
  values (v_tenant, p_group_id, v_contact)
  on conflict do nothing;

  return query select v_contact, v_existed;
end;
$$;

-- ===== Enviar para o grupo =====
create or replace function disparador.enqueue_group(
  p_group_id uuid,
  p_instance_id uuid,
  p_variant_group_id uuid,
  p_not_before timestamptz default null
)
returns table (
  campaign_id uuid,
  enfileiradas int,
  ignoradas_sem_optin int,
  ignoradas_optout int,
  ignoradas_outros int
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_group_name text;
  v_tz text;
  v_campaign uuid;
  v_member record;
  v_ok int := 0;
  v_no_optin int := 0;
  v_optout int := 0;
  v_other int := 0;
begin
  select g.tenant_id, g.name, t.timezone into v_tenant, v_group_name, v_tz
  from disparador.contact_groups g join public.tenants t on t.id = g.tenant_id
  where g.id = p_group_id;
  -- Grupo inexistente e grupo de outra igreja dão a mesma resposta
  if v_tenant is null
     or not (public.is_super_admin()
             or public.has_tenant_role(v_tenant, array['admin', 'coordenador']::public.app_role[])) then
    raise exception 'sem permissão para este grupo' using errcode = '42501';
  end if;

  if not exists (select 1 from disparador.instances i where i.id = p_instance_id and i.tenant_id = v_tenant) then
    raise exception 'instância não pertence a esta igreja' using errcode = '42501';
  end if;

  if not exists (select 1 from disparador.variant_groups v where v.id = p_variant_group_id and v.tenant_id = v_tenant) then
    raise exception 'grupo de variações inexistente nesta igreja' using errcode = '22023';
  end if;
  if (select count(*) from disparador.variants v
      where v.group_id = p_variant_group_id and v.tenant_id = v_tenant) < 3 then
    raise exception 'grupo precisa de pelo menos 3 variações' using errcode = 'DS003';
  end if;

  insert into disparador.campaigns
    (tenant_id, name, variant_group_id, status, created_by, contact_group_id, instance_id)
  values
    (v_tenant, v_group_name || ' · ' || to_char(now() at time zone v_tz, 'DD/MM/YYYY HH24:MI'),
     p_variant_group_id, 'running', auth.uid(), p_group_id, p_instance_id)
  returning id into v_campaign;

  for v_member in
    select c.name, c.phone_e164, c.opted_in_at, c.opted_out_at
    from disparador.contact_group_members m
    join disparador.contacts c on c.id = m.contact_id and c.tenant_id = m.tenant_id
    where m.group_id = p_group_id
    order by c.name, c.phone_e164
  loop
    if v_member.opted_out_at is not null then
      v_optout := v_optout + 1;
    elsif v_member.opted_in_at is null then
      v_no_optin := v_no_optin + 1;
    else
      begin
        -- Mensagem individual pelo caminho único da fila (personalização, anti-broadcast, opt-in, opt-out)
        perform disparador.enqueue_message(
          p_instance_id, v_member.phone_e164, v_member.name, 'grupo',
          p_campaign_id => v_campaign, p_not_before => p_not_before);
        v_ok := v_ok + 1;
      exception
        when sqlstate 'DS002' then v_no_optin := v_no_optin + 1;
        when sqlstate 'DS004' then v_optout := v_optout + 1;
        when sqlstate 'DS001' then v_other := v_other + 1;
      end;
    end if;
  end loop;

  update disparador.campaigns c
  set enqueued = v_ok, skipped_no_optin = v_no_optin, skipped_optout = v_optout, skipped_other = v_other,
      status = case when v_ok = 0 then 'done'::disparador.campaign_status else 'running'::disparador.campaign_status end
  where c.id = v_campaign;

  return query select v_campaign, v_ok, v_no_optin, v_optout, v_other;
end;
$$;

-- ===== Acompanhamento (SECURITY INVOKER → RLS: só campanhas da igreja do usuário) =====
create or replace function disparador.campaign_progress(p_campaign_id uuid)
returns table (
  campaign_id uuid,
  name text,
  created_at timestamptz,
  instance_id uuid,
  enfileiradas int,
  ignoradas_sem_optin int,
  ignoradas_optout int,
  ignoradas_outros int,
  queued bigint,
  sending bigint,
  sent bigint,
  failed bigint,
  cancelled bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id, c.name, c.created_at, c.instance_id,
    c.enqueued, c.skipped_no_optin, c.skipped_optout, c.skipped_other,
    count(m.id) filter (where m.status in ('queued', 'deferred')),
    count(m.id) filter (where m.status = 'sending'),
    count(m.id) filter (where m.status = 'sent'),
    count(m.id) filter (where m.status = 'failed'),
    count(m.id) filter (where m.status = 'cancelled')
  from disparador.campaigns c
  left join disparador.outbound_messages m on m.campaign_id = c.id and m.tenant_id = c.tenant_id
  where c.id = p_campaign_id
  group by c.id;
$$;

-- Últimas campanhas de um grupo de contatos
create or replace function disparador.group_campaigns(p_group_id uuid, p_limit int default 5)
returns table (
  campaign_id uuid,
  name text,
  created_at timestamptz,
  instance_id uuid,
  enfileiradas int,
  ignoradas_sem_optin int,
  ignoradas_optout int,
  ignoradas_outros int,
  queued bigint,
  sending bigint,
  sent bigint,
  failed bigint,
  cancelled bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from (
    select c.id from disparador.campaigns c
    where c.contact_group_id = p_group_id
    order by c.created_at desc
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  ) recent
  cross join lateral disparador.campaign_progress(recent.id) p
  order by p.created_at desc;
$$;

revoke execute on function disparador.add_group_member(uuid, text, text, boolean) from public, anon;
revoke execute on function disparador.enqueue_group(uuid, uuid, uuid, timestamptz) from public, anon;
revoke execute on function disparador.campaign_progress(uuid) from public, anon;
revoke execute on function disparador.group_campaigns(uuid, int) from public, anon;

grant execute on function disparador.add_group_member(uuid, text, text, boolean) to authenticated;
grant execute on function disparador.enqueue_group(uuid, uuid, uuid, timestamptz) to authenticated, service_role;
grant execute on function disparador.campaign_progress(uuid) to authenticated, service_role;
grant execute on function disparador.group_campaigns(uuid, int) to authenticated, service_role;
