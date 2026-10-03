-- Disparador: recebimento (EF disparador-webhook) e leitura de respostas pelos produtos. Tudo engine-only.

-- Instância pelo nome (o tenant vem da instância, nunca do número do remetente)
create or replace function disparador.webhook_instance(p_name text)
returns table (instance_id uuid, webhook_key_hash text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not disparador.is_engine() then
    raise exception 'só o motor resolve instâncias do webhook' using errcode = '42501';
  end if;
  return query select i.id, i.webhook_key_hash from disparador.instances i where i.name = p_name;
end;
$$;

-- Grava 1 mensagem recebida com dedup atómico por (instance_id, provider_message_id).
-- Devolve true se for nova. Mensagem nova que seja só "SAIR"/"PARAR" → opt-out do contato na igreja.
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
  end if;

  return true;
end;
$$;

-- Leitura das respostas por um produto (servidor do produto, como service_role)
create or replace function disparador.fetch_inbound(p_instance_id uuid, p_since timestamptz)
returns setof disparador.inbound_messages
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not disparador.is_engine() then
    raise exception 'só o motor/servidor lê respostas por RPC' using errcode = '42501';
  end if;
  return query
    select * from disparador.inbound_messages m
    where m.instance_id = p_instance_id and m.received_at > p_since
    order by m.received_at, m.id
    limit 1000;
end;
$$;

revoke execute on function disparador.webhook_instance(text) from public, anon, authenticated;
revoke execute on function disparador.record_inbound(uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function disparador.fetch_inbound(uuid, timestamptz) from public, anon, authenticated;

grant execute on function disparador.webhook_instance(text) to service_role;
grant execute on function disparador.record_inbound(uuid, text, text, text, timestamptz) to service_role;
grant execute on function disparador.fetch_inbound(uuid, timestamptz) to service_role;
