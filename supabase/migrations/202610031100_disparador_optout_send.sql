-- Disparador (QA Q1): opt-out respeitado no envio, com ou sem campanha.
-- enqueue_message recusa destinatário com opt-out (DS004); claim_next cancela em vez de enviar;
-- record_inbound (SAIR/PARAR) cancela a fila desse número na igreja. Assinaturas inalteradas.

create or replace function disparador.has_opted_out(p_tenant_id uuid, p_phone_e164 text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from disparador.contacts
    where tenant_id = p_tenant_id and phone_e164 = p_phone_e164 and opted_out_at is not null
  );
$$;
revoke execute on function disparador.has_opted_out(uuid, text) from public, anon, authenticated;
grant execute on function disparador.has_opted_out(uuid, text) to service_role;

create or replace function disparador.enqueue_message(
  p_instance_id uuid,
  p_recipient_e164 text,
  p_recipient_name text,
  p_product text,
  p_body text default null,
  p_variant_group_id uuid default null,
  p_campaign_id uuid default null,
  p_not_before timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_group uuid := p_variant_group_id;
  v_body text;
  v_variants int;
  v_id uuid;
begin
  select tenant_id into v_tenant from disparador.instances where id = p_instance_id;
  if v_tenant is null then
    raise exception 'instância inexistente' using errcode = '22023';
  end if;

  if not (disparador.is_engine() or public.is_super_admin()
          or public.has_tenant_role(v_tenant, array['admin', 'coordenador']::public.app_role[])) then
    raise exception 'sem permissão para enfileirar nesta igreja' using errcode = '42501';
  end if;

  if coalesce(btrim(p_recipient_name), '') = '' then
    raise exception 'nome do destinatário é obrigatório' using errcode = '22023';
  end if;
  if p_recipient_e164 is null or p_recipient_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'telefone deve estar em E.164' using errcode = '22023';
  end if;
  if coalesce(btrim(p_product), '') = '' then
    raise exception 'produto é obrigatório' using errcode = '22023';
  end if;

  -- Opt-out (SAIR/PARAR) vale para qualquer envio da igreja, com ou sem campanha
  if disparador.has_opted_out(v_tenant, p_recipient_e164) then
    raise exception 'destinatário pediu para não receber mensagens (opt-out)' using errcode = 'DS004';
  end if;

  if p_campaign_id is not null then
    select variant_group_id into v_group
    from disparador.campaigns where id = p_campaign_id and tenant_id = v_tenant;
    if v_group is null then
      raise exception 'campanha inexistente nesta igreja' using errcode = '22023';
    end if;
    if p_body is not null or (p_variant_group_id is not null and p_variant_group_id <> v_group) then
      raise exception 'campanha usa só o grupo de variações dela' using errcode = '22023';
    end if;
    if not exists (
      select 1 from disparador.contacts
      where tenant_id = v_tenant and phone_e164 = p_recipient_e164
        and opted_in_at is not null and opted_out_at is null
    ) then
      raise exception 'campanha só para contatos com opt-in' using errcode = 'DS002';
    end if;
  end if;

  if (p_body is null) = (v_group is null) then
    raise exception 'informe corpo OU grupo de variações' using errcode = '22023';
  end if;

  if v_group is not null then
    select count(*) into v_variants
    from disparador.variants where group_id = v_group and tenant_id = v_tenant;
    if v_variants < 3 then
      raise exception 'grupo precisa de pelo menos 3 variações' using errcode = 'DS003';
    end if;
    select replace(template, '{nome}', btrim(p_recipient_name)) into v_body
    from disparador.variants where group_id = v_group and tenant_id = v_tenant
    order by random() limit 1;
  else
    v_body := p_body;
  end if;

  if coalesce(btrim(v_body), '') = '' then
    raise exception 'mensagem vazia' using errcode = '22023';
  end if;

  -- Anti-broadcast: o mesmo texto para outro número nas últimas 24h
  if exists (
    select 1 from disparador.outbound_messages
    where tenant_id = v_tenant and md5(body) = md5(v_body) and body = v_body
      and recipient_e164 <> p_recipient_e164
      and created_at > now() - interval '24 hours'
      and status <> 'cancelled'
  ) then
    raise exception 'mesmo texto para vários números (broadcast) não é permitido' using errcode = 'DS001';
  end if;

  insert into disparador.outbound_messages
    (tenant_id, instance_id, product, recipient_e164, recipient_name, body, variant_group_id, campaign_id, not_before)
  values
    (v_tenant, p_instance_id, btrim(p_product), p_recipient_e164, btrim(p_recipient_name), v_body, v_group,
     p_campaign_id, coalesce(p_not_before, now()))
  returning id into v_id;

  return v_id;
end;
$$;

-- claim_next: igual ao anterior, mas mensagem para quem fez opt-out é cancelada (não enviada, não conta no cap)
-- e segue para a próxima elegível.
create or replace function disparador.claim_next(p_instance_id uuid)
returns disparador.outbound_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inst disparador.instances%rowtype;
  v_local timestamp;
  v_used int;
  v_msg disparador.outbound_messages%rowtype;
begin
  if not disparador.is_engine() then
    raise exception 'só o motor reclama mensagens' using errcode = '42501';
  end if;

  -- Lock por instância: nunca dois envios em paralelo no mesmo número
  select * into v_inst from disparador.instances where id = p_instance_id for update skip locked;
  if not found or v_inst.status <> 'open' or now() < v_inst.next_allowed_at then
    return null;
  end if;

  select now() at time zone t.timezone into v_local from public.tenants t where t.id = v_inst.tenant_id;
  if v_local::time < v_inst.window_start or v_local::time >= v_inst.window_end then
    return null;
  end if;

  select sent into v_used from disparador.daily_usage
  where instance_id = p_instance_id and day = v_local::date;
  if coalesce(v_used, 0) >= v_inst.daily_cap then
    return null;
  end if;

  loop
    select * into v_msg from disparador.outbound_messages
    where instance_id = p_instance_id and status = 'queued' and not_before <= now()
    order by created_at
    limit 1
    for update skip locked;
    if not found then
      return null;
    end if;
    exit when not disparador.has_opted_out(v_inst.tenant_id, v_msg.recipient_e164);
    update disparador.outbound_messages set status = 'cancelled', error = 'opted_out' where id = v_msg.id;
  end loop;

  update disparador.outbound_messages
  set status = 'sending', attempts = attempts + 1
  where id = v_msg.id
  returning * into v_msg;

  update disparador.instances
  set next_allowed_at = now() + make_interval(
    secs => v_inst.min_delay_s + floor(random() * (v_inst.max_delay_s - v_inst.min_delay_s + 1))::int)
  where id = p_instance_id;

  insert into disparador.daily_usage (instance_id, day, sent)
  values (p_instance_id, v_local::date, 1)
  on conflict (instance_id, day) do update set sent = disparador.daily_usage.sent + 1;

  return v_msg;
end;
$$;

-- record_inbound: igual ao anterior + ao aplicar opt-out cancela a fila pendente desse número na igreja
create or replace function disparador.record_inbound(
  p_instance_id uuid,
  p_sender_e164 text,
  p_body text,
  p_provider_message_id text,
  p_provider_ts timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_id uuid;
begin
  if not disparador.is_engine() then
    raise exception 'só o motor grava mensagens recebidas' using errcode = '42501';
  end if;

  select tenant_id into v_tenant from disparador.instances where id = p_instance_id;
  if v_tenant is null then
    raise exception 'instância inexistente' using errcode = '22023';
  end if;
  if p_sender_e164 is null or p_sender_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'remetente deve estar em E.164' using errcode = '22023';
  end if;
  if coalesce(btrim(p_provider_message_id), '') = '' then
    raise exception 'id da mensagem do provedor é obrigatório' using errcode = '22023';
  end if;

  insert into disparador.inbound_messages (tenant_id, instance_id, sender_e164, body, provider_message_id, provider_ts)
  values (v_tenant, p_instance_id, p_sender_e164, p_body, p_provider_message_id, p_provider_ts)
  on conflict (instance_id, provider_message_id) do nothing
  returning id into v_id;

  if v_id is null then
    return false;
  end if;

  -- Opt-out: a mensagem inteira (sem pontuação/espaços) é SAIR ou PARAR
  if upper(regexp_replace(coalesce(p_body, ''), '[^[:alpha:]]+', '', 'g')) in ('SAIR', 'PARAR') then
    insert into disparador.contacts (tenant_id, phone_e164, name, opted_out_at, source)
    values (v_tenant, p_sender_e164, '', now(), 'webhook-optout')
    on conflict (tenant_id, phone_e164) do update
      set opted_out_at = coalesce(disparador.contacts.opted_out_at, now());

    update disparador.outbound_messages
    set status = 'cancelled', error = 'opted_out'
    where tenant_id = v_tenant and recipient_e164 = p_sender_e164 and status in ('queued', 'deferred');
  end if;

  return true;
end;
$$;
