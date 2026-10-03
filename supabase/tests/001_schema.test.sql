-- Fundação multi-tenant: estrutura esperada (tabelas, enum, funções, restrições).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- enum de roles
select has_type('public', 'app_role', 'enum app_role existe');
select enum_has_labels('public', 'app_role',
  array['super_admin', 'admin', 'coordenador', 'mentor'],
  'app_role tem as 4 roles');

-- tabelas
select has_table('public', 'tenants', 'tabela tenants existe');
select has_table('public', 'profiles', 'tabela profiles existe');
select has_table('public', 'tenant_memberships', 'tabela tenant_memberships existe');
select has_table('public', 'tenant_modules', 'tabela tenant_modules existe');

-- tenants
select col_not_null('public', 'tenants', 'cnpj', 'tenants.cnpj obrigatório');
select col_is_unique('public', 'tenants', 'cnpj', 'tenants.cnpj único');
select col_is_unique('public', 'tenants', 'slug', 'tenants.slug único');
select col_default_is('public', 'tenants', 'timezone', 'America/Sao_Paulo'::text,
  'tenants.timezone por defeito America/Sao_Paulo');

-- memberships
select col_is_fk('public', 'tenant_memberships', 'tenant_id', 'membership -> tenants');
select col_is_unique('public', 'tenant_memberships', array['tenant_id', 'user_id'],
  'uma membership por utilizador e tenant');

-- RLS ativa
select is(
  (select relrowsecurity from pg_class where oid = 'public.tenants'::regclass),
  true, 'RLS ativa em tenants');
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true, 'RLS ativa em profiles');
select is(
  (select relrowsecurity from pg_class where oid = 'public.tenant_memberships'::regclass),
  true, 'RLS ativa em tenant_memberships');
select is(
  (select relrowsecurity from pg_class where oid = 'public.tenant_modules'::regclass),
  true, 'RLS ativa em tenant_modules');

-- funções de segurança
select has_function('public', 'is_super_admin', array[]::text[], 'is_super_admin() existe');
select has_function('public', 'is_tenant_member', array['uuid'], 'is_tenant_member(uuid) existe');
select has_function('public', 'has_tenant_role', array['uuid', 'app_role[]'],
  'has_tenant_role(uuid, app_role[]) existe');
select is_definer('public', 'is_tenant_member', array['uuid'], 'is_tenant_member é SECURITY DEFINER');
select is_definer('public', 'has_tenant_role', array['uuid', 'app_role[]'],
  'has_tenant_role é SECURITY DEFINER');
select has_function('public', 'is_valid_cnpj', array['text'], 'is_valid_cnpj(text) existe');
select has_function('public', 'set_tenant_settings', array['uuid', 'text', 'text'],
  'RPC set_tenant_settings(uuid, text, text) existe');
select is_definer('public', 'set_tenant_settings', array['uuid', 'text', 'text'],
  'set_tenant_settings é SECURITY DEFINER');

select * from finish();
rollback;
