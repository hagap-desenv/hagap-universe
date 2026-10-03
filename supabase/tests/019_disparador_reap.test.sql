-- Disparador (QA Q4): varredura de mensagens presas em `sending` → failed/unknown_outcome, sem reenviar.
-- Assinatura: disparador.reap_stuck_sending(p_older_than interval default '5 minutes') returns int
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_function('disparador', 'reap_stuck_sending', array['interval'], 'reap_stuck_sending existe');

insert into public.tenants (id, name, cnpj, slug) values
  ('29000000-0000-0000-0000-00000000000a', 'Igreja Reap A', '11222333000181', 'igreja-reap-a');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'reap.admin.a@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('29000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a1', 'admin');
insert into disparador.instances (id, tenant_id, name, phone_e164) values
  ('49000000-0000-0000-0000-00000000000a', '29000000-0000-0000-0000-00000000000a', 'reap-a', '+5511979500000');
insert into disparador.outbound_messages
  (id, tenant_id, instance_id, product, recipient_e164, recipient_name, body, status, attempts, updated_at) values
  ('69000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-00000000000a', '49000000-0000-0000-0000-00000000000a',
   'pai', '+5511979500001', 'Antigo', 'Olá Antigo', 'sending', 1, now() - interval '10 minutes'),
  ('69000000-0000-0000-0000-000000000002', '29000000-0000-0000-0000-00000000000a', '49000000-0000-0000-0000-00000000000a',
   'pai', '+5511979500002', 'Recente', 'Olá Recente', 'sending', 1, now() - interval '1 minute');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is(disparador.reap_stuck_sending(), 1, 'uma mensagem presa varrida');
select is((select status::text || ':' || error from disparador.outbound_messages
           where id = '69000000-0000-0000-0000-000000000001'),
  'failed:unknown_outcome', 'presa há 10 min → failed/unknown_outcome');
select is((select attempts from disparador.outbound_messages where id = '69000000-0000-0000-0000-000000000001'), 1,
  'attempts intocado (sem reenvio)');
select is((select status::text from disparador.outbound_messages where id = '69000000-0000-0000-0000-000000000002'),
  'sending', 'mensagem recente continua sending');
select is(disparador.reap_stuck_sending(), 0, 'segunda varredura não muda nada (não volta a queued)');
select is((select status::text from disparador.outbound_messages where id = '69000000-0000-0000-0000-000000000001'),
  'failed', 'continua failed');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000009a1","role":"authenticated"}', true);
select throws_ok($$ select disparador.reap_stuck_sending() $$, '42501', null, 'authenticated não varre a fila');
reset role;

select * from finish();
rollback;
