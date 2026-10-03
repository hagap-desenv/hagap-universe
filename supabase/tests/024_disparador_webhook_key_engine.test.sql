-- Disparador: chave do webhook rotacionada pelo motor no fluxo de conexão (EF disparador-instance-connect).
-- Assinatura: disparador.set_webhook_key_hash(p_instance_id uuid, p_hash text) returns void — engine-only;
-- guarda só o sha256 hex. rotate_webhook_key (manual, admin) continua a funcionar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_function('disparador', 'set_webhook_key_hash', array['uuid', 'text'], 'set_webhook_key_hash existe');

insert into public.tenants (id, name, cnpj, slug) values
  ('2d000000-0000-0000-0000-00000000000a', 'Igreja Chave A', '11222333000181', 'igreja-chave-a');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000da1', 'chave.admin.a@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('2d000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000da1', 'admin');
insert into disparador.instances (id, tenant_id, name, phone_e164) values
  ('4d000000-0000-0000-0000-00000000000a', '2d000000-0000-0000-0000-00000000000a', 'chave-a', '+5511979950000');

-- Motor
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok(
  $$ select disparador.set_webhook_key_hash('4d000000-0000-0000-0000-00000000000a',
       encode(extensions.digest('dk_chave_ficticia', 'sha256'), 'hex')) $$,
  'motor grava o hash da chave');
select is((select webhook_key_hash from disparador.instances where id = '4d000000-0000-0000-0000-00000000000a'),
  encode(extensions.digest('dk_chave_ficticia', 'sha256'), 'hex'), 'hash guardado (nunca a chave)');
select throws_ok(
  $$ select disparador.set_webhook_key_hash('4d000000-0000-0000-0000-00000000000a', 'dk_chave_em_texto') $$,
  '22023', null, 'só aceita sha256 hex (64 caracteres)');
select throws_ok(
  $$ select disparador.set_webhook_key_hash('4d000000-0000-0000-0000-0000000000ff', repeat('a', 64)) $$,
  '22023', null, 'instância inexistente é recusada');

-- Cliente autenticado (admin): não usa a RPC do motor; a rotação manual continua
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000da1","role":"authenticated"}', true);
select throws_ok(
  $$ select disparador.set_webhook_key_hash('4d000000-0000-0000-0000-00000000000a', repeat('b', 64)) $$,
  '42501', null, 'authenticated não grava hash pelo caminho do motor');
select matches(disparador.rotate_webhook_key('4d000000-0000-0000-0000-00000000000a'), '^dk_[0-9a-f]{64}$',
  'rotate_webhook_key (manual) continua a devolver a chave uma vez');
reset role;
select isnt((select webhook_key_hash from disparador.instances where id = '4d000000-0000-0000-0000-00000000000a'),
  encode(extensions.digest('dk_chave_ficticia', 'sha256'), 'hex'), 'rotação manual trocou o hash');

select * from finish();
rollback;
