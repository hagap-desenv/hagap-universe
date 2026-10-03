-- Isolamento entre tenants e permissões por role. Só dados fictícios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Utilizadores fictícios
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000000a2', 'mentor.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000000b1', 'admin.b@teste.invalid'),
  ('00000000-0000-0000-0000-0000000000f0', 'super@teste.invalid');

insert into public.profiles (id, full_name, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin A', 'admin.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000000a2', 'Mentor A', 'mentor.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000000b1', 'Admin B', 'admin.b@teste.invalid'),
  ('00000000-0000-0000-0000-0000000000f0', 'Super', 'super@teste.invalid')
on conflict (id) do nothing;
update public.profiles set global_role = 'super_admin'
  where id = '00000000-0000-0000-0000-0000000000f0';

-- Igrejas fictícias
insert into public.tenants (id, name, cnpj, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Igreja Teste A', '11222333000181', 'igreja-teste-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Igreja Teste B', '11444777000161', 'igreja-teste-b');

insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'mentor'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'admin');

insert into public.tenant_modules (tenant_id, module_key, enabled) values
  ('10000000-0000-0000-0000-00000000000a', 'cuidado', true),
  ('10000000-0000-0000-0000-00000000000b', 'cuidado', true)
on conflict do nothing;

-- Regras de estrutura
select throws_ok(
  $$ insert into public.tenant_memberships (tenant_id, user_id, role)
     values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a2', 'super_admin') $$,
  '23514', null, 'super_admin não pode ser role de membership');

-- ===== Admin do tenant A =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select results_eq(
  $$ select slug from public.tenants order by slug $$,
  array['igreja-teste-a'::text],
  'admin A só vê o tenant A');
select is_empty(
  $$ select 1 from public.tenant_memberships where tenant_id = '10000000-0000-0000-0000-00000000000b' $$,
  'admin A não vê memberships do tenant B');
select is_empty(
  $$ select 1 from public.tenant_modules where tenant_id = '10000000-0000-0000-0000-00000000000b' $$,
  'admin A não vê módulos do tenant B');
select is_empty(
  $$ select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'admin A não vê perfil de utilizador só do tenant B');
select throws_ok(
  $$ insert into public.tenant_memberships (tenant_id, user_id, role)
     values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a1', 'admin') $$,
  '42501', null, 'admin A não se insere no tenant B');
select lives_ok(
  $$ select public.set_tenant_settings('10000000-0000-0000-0000-00000000000a', 'Igreja Teste A2', 'America/Manaus') $$,
  'admin A altera configuração do seu tenant via RPC');
select throws_ok(
  $$ select public.set_tenant_settings('10000000-0000-0000-0000-00000000000b', 'Hack', 'UTC') $$,
  '42501', null, 'admin A não altera configuração do tenant B');
-- update direto (fora da RPC) não afeta linhas
update public.tenants set name = 'Direto' where id = '10000000-0000-0000-0000-00000000000a';
reset role;
select is(
  (select name from public.tenants where id = '10000000-0000-0000-0000-00000000000a'),
  'Igreja Teste A2', 'update direto em tenants é ignorado (só via RPC)');

-- ===== Mentor do tenant A =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

select results_eq(
  $$ select slug from public.tenants $$,
  array['igreja-teste-a'::text],
  'mentor A vê só o tenant A');
select throws_ok(
  $$ select public.set_tenant_settings('10000000-0000-0000-0000-00000000000a', 'Mentor', 'UTC') $$,
  '42501', null, 'mentor não altera configuração do tenant');

-- ===== Super admin =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f0","role":"authenticated"}', true);
select results_eq(
  $$ select count(*)::int from public.tenants $$,
  array[2], 'super_admin vê todos os tenants');

-- ===== Anónimo =====
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is_empty($$ select 1 from public.tenants $$, 'anónimo não vê tenants');
select is_empty($$ select 1 from public.tenant_memberships $$, 'anónimo não vê memberships');

reset role;
select * from finish();
rollback;
