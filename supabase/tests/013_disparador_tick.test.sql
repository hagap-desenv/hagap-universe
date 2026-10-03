-- Disparador: RPCs do tick (heartbeat, estado da instância, instâncias a despachar). Só o motor. Dados fictícios.
-- Assinaturas: disparador.touch_heartbeat(p_job text, p_status text, p_detail jsonb default '{}') returns void
--              disparador.set_instance_status(p_instance_id uuid, p_status disparador.instance_status) returns void
--              disparador.list_dispatchable_instances() returns table(instance_id uuid, instance_name text)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('disparador', 'heartbeats', 'tabela heartbeats');
select ok((select relrowsecurity from pg_class where oid = 'disparador.heartbeats'::regclass),
  'heartbeats com RLS ativa');
select has_function('disparador', 'touch_heartbeat', array['text', 'text', 'jsonb'], 'touch_heartbeat existe');
select has_function('disparador', 'set_instance_status', array['uuid', 'disparador.instance_status'],
  'set_instance_status existe');
select has_function('disparador', 'list_dispatchable_instances', array[]::text[], 'list_dispatchable_instances existe');

insert into public.tenants (id, name, cnpj, slug) values
  ('23000000-0000-0000-0000-00000000000a', 'Igreja Tick A', '11222333000181', 'igreja-tick-a');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003a1', 'tick.admin.a@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('23000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000003a1', 'admin');
insert into disparador.instances (id, tenant_id, name, phone_e164, status, next_allowed_at) values
  ('43000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-00000000000a', 'tick-pronta', '+5511970000001', 'open', now() - interval '1 minute'),
  ('43000000-0000-0000-0000-000000000002', '23000000-0000-0000-0000-00000000000a', 'tick-futura', '+5511970000002', 'open', now() - interval '1 minute'),
  ('43000000-0000-0000-0000-000000000003', '23000000-0000-0000-0000-00000000000a', 'tick-desligada', '+5511970000003', 'disconnected', now() - interval '1 minute'),
  ('43000000-0000-0000-0000-000000000004', '23000000-0000-0000-0000-00000000000a', 'tick-intervalo', '+5511970000004', 'open', now() + interval '1 minute'),
  ('43000000-0000-0000-0000-000000000005', '23000000-0000-0000-0000-00000000000a', 'tick-vazia', '+5511970000005', 'open', now() - interval '1 minute');
insert into disparador.outbound_messages (tenant_id, instance_id, product, recipient_e164, recipient_name, body, not_before) values
  ('23000000-0000-0000-0000-00000000000a', '43000000-0000-0000-0000-000000000001', 'pai', '+5511971000001', 'Um', 'Olá Um', now() - interval '1 minute'),
  ('23000000-0000-0000-0000-00000000000a', '43000000-0000-0000-0000-000000000002', 'pai', '+5511971000002', 'Dois', 'Olá Dois', now() + interval '1 hour'),
  ('23000000-0000-0000-0000-00000000000a', '43000000-0000-0000-0000-000000000003', 'pai', '+5511971000003', 'Tres', 'Olá Tres', now() - interval '1 minute'),
  ('23000000-0000-0000-0000-00000000000a', '43000000-0000-0000-0000-000000000004', 'pai', '+5511971000004', 'Quatro', 'Olá Quatro', now() - interval '1 minute');
insert into disparador.outbound_messages (tenant_id, instance_id, product, recipient_e164, recipient_name, body, status) values
  ('23000000-0000-0000-0000-00000000000a', '43000000-0000-0000-0000-000000000005', 'pai', '+5511971000005', 'Cinco', 'Olá Cinco', 'sent');

-- Motor (service_role)
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select results_eq(
  $$ select instance_name from disparador.list_dispatchable_instances() $$,
  array['tick-pronta'::text],
  'só instâncias open, com intervalo cumprido e fila vencida são despachadas');

select lives_ok($$ select disparador.touch_heartbeat('disparador-tick', 'ok', '{"sent":1}') $$, 'heartbeat gravado');
select lives_ok($$ select disparador.touch_heartbeat('disparador-tick', 'error', '{"error":"x"}') $$, 'heartbeat atualizado');
select is((select count(*)::int from disparador.heartbeats where job = 'disparador-tick'), 1, '1 linha por job');
select is((select last_status || ':' || (detail ->> 'error') from disparador.heartbeats where job = 'disparador-tick'),
  'error:x', 'heartbeat guarda o último estado e detalhe');

select lives_ok(
  $$ select disparador.set_instance_status('43000000-0000-0000-0000-000000000001', 'disconnected') $$,
  'motor marca a instância como desligada');
select is((select status::text from disparador.instances where id = '43000000-0000-0000-0000-000000000001'),
  'disconnected', 'estado da instância alterado');
select is_empty($$ select 1 from disparador.list_dispatchable_instances() $$,
  'instância desligada deixa de ser despachada');

-- Cliente autenticado (admin da igreja) não usa as RPCs do motor nem lê heartbeats
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000003a1","role":"authenticated"}', true);
select throws_ok($$ select disparador.touch_heartbeat('x', 'ok') $$, '42501', null,
  'authenticated não grava heartbeat');
select throws_ok($$ select disparador.set_instance_status('43000000-0000-0000-0000-000000000005', 'open') $$,
  '42501', null, 'authenticated não altera o estado da instância');
select throws_ok($$ select * from disparador.list_dispatchable_instances() $$, '42501', null,
  'authenticated não lista instâncias para envio');
reset role;

select * from finish();
rollback;
