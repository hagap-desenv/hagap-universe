-- Disparador: tick agendado a cada minuto; disparo só pelo agendador (nunca por usuário).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_function('disparador', 'invoke_tick', array[]::text[], 'invoke_tick existe');
select is_definer('disparador', 'invoke_tick', array[]::text[], 'invoke_tick é SECURITY DEFINER');
select is(
  (select schedule from cron.job where jobname = 'disparador-tick'),
  '* * * * *', 'tick agendado a cada minuto');
select ok(
  not has_function_privilege('authenticated', 'disparador.invoke_tick()', 'execute'),
  'authenticated não dispara o tick');

select * from finish();
rollback;
