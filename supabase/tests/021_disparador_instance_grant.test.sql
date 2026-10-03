-- Disparador (QA Q6): grant mínimo — admin cria instância só com colunas de configuração;
-- estado, chave do webhook e agenda de envio ficam com o motor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.tenants (id, name, cnpj, slug) values
  ('2b000000-0000-0000-0000-00000000000a', 'Igreja Grant A', '11222333000181', 'igreja-grant-a');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000ba1', 'grant.admin.a@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('2b000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000ba1', 'admin');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000ba1","role":"authenticated"}', true);

select throws_ok(
  $$ insert into disparador.instances (tenant_id, name, phone_e164, status)
     values ('2b000000-0000-0000-0000-00000000000a', 'grant-open', '+5511979800001', 'open') $$,
  '42501', null, 'admin não cria instância já open');
select throws_ok(
  $$ insert into disparador.instances (tenant_id, name, phone_e164, webhook_key_hash)
     values ('2b000000-0000-0000-0000-00000000000a', 'grant-hash', '+5511979800002', repeat('a', 64)) $$,
  '42501', null, 'admin não define o hash da chave do webhook');
select throws_ok(
  $$ insert into disparador.instances (tenant_id, name, phone_e164, next_allowed_at)
     values ('2b000000-0000-0000-0000-00000000000a', 'grant-agenda', '+5511979800003', now() - interval '1 day') $$,
  '42501', null, 'admin não define a agenda de envio');
select lives_ok(
  $$ insert into disparador.instances (tenant_id, name, phone_e164, daily_cap, window_start, window_end,
       min_delay_s, max_delay_s)
     values ('2b000000-0000-0000-0000-00000000000a', 'grant-config', '+5511979800004', 20, '08:00', '20:00', 50, 80) $$,
  'admin cria instância só com configuração');
reset role;
select is((select status::text from disparador.instances where name = 'grant-config'), 'disconnected',
  'instância nova nasce desligada');

select * from finish();
rollback;
