-- Disparador: rotação da chave do webhook pelo motor no fluxo de conexão (EF disparador-instance-connect).
-- A EF gera a chave, configura-a na Evolution e grava aqui só o sha256 hex. rotate_webhook_key (manual) continua.
create or replace function disparador.set_webhook_key_hash(p_instance_id uuid, p_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not disparador.is_engine() then
    raise exception 'só o motor grava o hash da chave do webhook' using errcode = '42501';
  end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash deve ser sha256 hex' using errcode = '22023';
  end if;
  update disparador.instances set webhook_key_hash = p_hash where id = p_instance_id;
  if not found then
    raise exception 'instância inexistente' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function disparador.set_webhook_key_hash(uuid, text) from public, anon, authenticated;
grant execute on function disparador.set_webhook_key_hash(uuid, text) to service_role;
