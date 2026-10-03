-- Disparador (QA Q9): o cliente não troca telefone nem igreja de um contato (fecha o desvio
-- "renomear o número com opt-out e recadastrar o original com opt-in"). Só dados fictícios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.tenants (id, name, cnpj, slug) values
  ('29000000-0000-0000-0000-00000000000a', 'Igreja Ident A', '11222333000181', 'igreja-ident-a'),
  ('29000000-0000-0000-0000-00000000000b', 'Igreja Ident B', '11444777000161', 'igreja-ident-b');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'ident.coord.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000009a2', 'ident.admin.ab@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('29000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a1', 'coordenador'),
  ('29000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a2', 'admin'),
  ('29000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000009a2', 'admin');
insert into disparador.contacts (id, tenant_id, phone_e164, name, opted_in_at, opted_out_at) values
  ('79000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-00000000000a', '+5511978000001', 'Saiu Ident',
   now() - interval '2 days', now() - interval '1 day');

-- Coordenador da igreja A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000009a1","role":"authenticated"}', true);
select throws_ok(
  $$ update disparador.contacts set phone_e164 = '+5511978000099' where id = '79000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'coordenador não troca o telefone do contato');
select lives_ok(
  $$ update disparador.contacts set name = 'Saiu Ident 2' where id = '79000000-0000-0000-0000-000000000001' $$,
  'nome continua editável');

-- Admin de duas igrejas
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000009a2","role":"authenticated"}', true);
select throws_ok(
  $$ update disparador.contacts set phone_e164 = '+5511978000098' where id = '79000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'admin não troca o telefone do contato');
select throws_ok(
  $$ update disparador.contacts set tenant_id = '29000000-0000-0000-0000-00000000000b' where id = '79000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'admin de duas igrejas não move o contato de igreja');
select lives_ok(
  $$ update disparador.contacts set source = 'manual' where id = '79000000-0000-0000-0000-000000000001' $$,
  'origem continua editável');
reset role;

-- O número original continua com opt-out na igreja A
select ok(disparador.has_opted_out('29000000-0000-0000-0000-00000000000a', '+5511978000001'),
  'opt-out do número original preservado');
select is((select tenant_id from disparador.contacts where id = '79000000-0000-0000-0000-000000000001'),
  '29000000-0000-0000-0000-00000000000a'::uuid, 'contato continua na igreja A');

select * from finish();
rollback;
