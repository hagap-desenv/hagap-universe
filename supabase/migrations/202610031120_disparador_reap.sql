-- Disparador (QA Q4): varredura de mensagens presas em `sending` (ex.: mark_sent falhou após o envio).
-- Resultado desconhecido → failed/unknown_outcome. Nunca volta a queued (evita mensagem duplicada).
create or replace function disparador.reap_stuck_sending(p_older_than interval default '5 minutes')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not disparador.is_engine() then
    raise exception 'só o motor varre a fila' using errcode = '42501';
  end if;
  update disparador.outbound_messages
  set status = 'failed', error = 'unknown_outcome'
  where status = 'sending' and updated_at < now() - p_older_than;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function disparador.reap_stuck_sending(interval) from public, anon, authenticated;
grant execute on function disparador.reap_stuck_sending(interval) to service_role;
