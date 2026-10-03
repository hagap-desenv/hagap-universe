-- Disparador: RPCs do app apps/disparador (chave do webhook, alvo do QR, painel, grupos de variações).
-- Autorização sempre por auth.uid() no banco; "não encontrada" e "outra igreja" dão o mesmo 42501.

-- Gera/rotaciona a chave do webhook. Devolve a chave em texto UMA vez; guarda só o sha256 hex.
create or replace function disparador.rotate_webhook_key(p_instance_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_key text;
begin
  select tenant_id into v_tenant from disparador.instances where id = p_instance_id;
  if v_tenant is null
     or not (public.is_super_admin() or public.has_tenant_role(v_tenant, array['admin']::public.app_role[])) then
    raise exception 'sem permissão para esta instância' using errcode = '42501';
  end if;

  v_key := 'dk_' || encode(extensions.gen_random_bytes(32), 'hex');
  update disparador.instances
  set webhook_key_hash = encode(pg_catalog.sha256(pg_catalog.convert_to(v_key, 'UTF8')), 'hex')
  where id = p_instance_id;
  return v_key;
end;
$$;

-- Nome da instância a ligar por QR (usado pela EF disparador-instance-connect com o JWT do usuário)
create or replace function disparador.connect_target(p_instance_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_name text;
begin
  select tenant_id, name into v_tenant, v_name from disparador.instances where id = p_instance_id;
  if v_tenant is null
     or not (public.is_super_admin() or public.has_tenant_role(v_tenant, array['admin']::public.app_role[])) then
    raise exception 'sem permissão para esta instância' using errcode = '42501';
  end if;
  return v_name;
end;
$$;

-- Painel: estado, fila por status e uso de hoje (hora local da igreja) vs cap. SECURITY INVOKER → RLS.
create or replace function disparador.instance_overview(p_tenant_id uuid)
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
  has_webhook_key boolean
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
    i.webhook_key_hash is not null as has_webhook_key
  from disparador.instances i
  join public.tenants t on t.id = i.tenant_id
  left join disparador.outbound_messages m on m.instance_id = i.id
  where i.tenant_id = p_tenant_id
  group by i.id, t.timezone
  order by i.name;
$$;

-- Grupo de variações atómico (≥ 3, todas com {nome}). SECURITY INVOKER → policies de escrita valem.
create or replace function disparador.create_variant_group(p_tenant_id uuid, p_name text, p_templates text[])
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_templates text[];
  v_group uuid;
begin
  select coalesce(array_agg(btrim(t)), '{}') into v_templates
  from unnest(p_templates) as t
  where coalesce(btrim(t), '') <> '';

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'nome do grupo é obrigatório' using errcode = '22023';
  end if;
  if coalesce(array_length(v_templates, 1), 0) < 3 then
    raise exception 'grupo precisa de pelo menos 3 variações' using errcode = '22023';
  end if;

  insert into disparador.variant_groups (tenant_id, name)
  values (p_tenant_id, btrim(p_name))
  returning id into v_group;

  insert into disparador.variants (tenant_id, group_id, template)
  select p_tenant_id, v_group, t from unnest(v_templates) as t;

  return v_group;
end;
$$;

revoke execute on function disparador.rotate_webhook_key(uuid) from public, anon;
revoke execute on function disparador.connect_target(uuid) from public, anon;
revoke execute on function disparador.instance_overview(uuid) from public, anon;
revoke execute on function disparador.create_variant_group(uuid, text, text[]) from public, anon;

grant execute on function disparador.rotate_webhook_key(uuid) to authenticated;
grant execute on function disparador.connect_target(uuid) to authenticated;
grant execute on function disparador.instance_overview(uuid) to authenticated;
grant execute on function disparador.create_variant_group(uuid, text, text[]) to authenticated;
