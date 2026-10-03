-- Disparador (QA Q2): opt-out irreversível — cliente não limpa opted_out_at nem apaga contato com opt-out
-- (fecha o caminho delete + re-insert). Motor (service_role) pode. Exclusão da igreja continua a funcionar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.tenants (id, name, cnpj, slug) values
  ('28000000-0000-0000-0000-00000000000a', 'Igreja Lock A', '11222333000181', 'igreja-lock-a');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'lock.coord.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000008a2', 'lock.admin.a@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('28000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000008a1', 'coordenador'),
  ('28000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000008a2', 'admin');
insert into disparador.contacts (id, tenant_id, phone_e164, name, opted_in_at, opted_out_at) values
  ('78000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-00000000000a', '+5511979000001', 'Saiu Teste',
   now() - interval '2 days', now() - interval '1 day'),
  ('78000000-0000-0000-0000-000000000002', '28000000-0000-0000-0000-00000000000a', '+5511979000002', 'Ativo Teste',
   now() - interval '2 days', null);

-- Coordenador da igreja
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000008a1","role":"authenticated"}', true);
select throws_ok(
  $$ update disparador.contacts set opted_out_at = null where id = '78000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'coordenador não desfaz opt-out');
select throws_ok(
  $$ delete from disparador.contacts where id = '78000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'coordenador não apaga contato com opt-out');
select lives_ok(
  $$ update disparador.contacts set name = 'Saiu Teste Renomeado' where id = '78000000-0000-0000-0000-000000000001' $$,
  'outros campos do contato com opt-out continuam editáveis');
select lives_ok(
  $$ delete from disparador.contacts where id = '78000000-0000-0000-0000-000000000002' $$,
  'contato sem opt-out pode ser apagado');

-- Admin da igreja
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000008a2","role":"authenticated"}', true);
select throws_ok(
  $$ update disparador.contacts set opted_out_at = null where id = '78000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'admin não desfaz opt-out');
select throws_ok(
  $$ delete from disparador.contacts where id = '78000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'admin não apaga contato com opt-out');
reset role;

select ok((select opted_out_at is not null from disparador.contacts where id = '78000000-0000-0000-0000-000000000001'),
  'opt-out preservado');

-- Motor (service_role) pode corrigir; exclusão da igreja (cascade) continua possível
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok(
  $$ update disparador.contacts set opted_out_at = null where id = '78000000-0000-0000-0000-000000000001' $$,
  'motor pode limpar opt-out (correção operacional)');
update disparador.contacts set opted_out_at = now() where id = '78000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '', true);
select lives_ok($$ delete from public.tenants where id = '28000000-0000-0000-0000-00000000000a' $$,
  'apagar a igreja apaga também os contatos com opt-out (cascade)');

select * from finish();
rollback;
