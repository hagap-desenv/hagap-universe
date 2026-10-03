-- Disparador: agenda o tick do motor a cada minuto via pg_cron + pg_net.
-- Independente de ambiente: URL e segredo vêm do Vault (configurados por ambiente, nunca no código):
--   vault.create_secret('<https://<ref>.supabase.co/functions/v1/disparador-tick>', 'disparador_tick_url')
--   vault.create_secret('<mesmo valor de DISPARADOR_CRON_SECRET>', 'disparador_cron_secret')
-- Sem os segredos no Vault, o job não chama nada (ambiente sem motor ativo, ex. CI).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function disparador.invoke_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'disparador_tick_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'disparador_cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
end;
$$;

revoke execute on function disparador.invoke_tick() from public, anon, authenticated;

select cron.schedule('disparador-tick', '* * * * *', 'select disparador.invoke_tick()');
