-- Hub (painel de apps): chaves de módulo `pai` e `disparador` em tenant_modules e leitura isolada por igreja.
-- `cuidado` continua sendo o módulo interno do PAI (menu "Cuidado"); `pai`/`disparador` = acesso aos apps.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.tenants (id, name, cnpj, slug) values
  ('29000000-0000-0000-0000-00000000000a', 'Igreja Hub A', '11222333000181', 'igreja-hub-a'),
  ('29000000-0000-0000-0000-00000000000b', 'Igreja Hub B', '11444777000161', 'igreja-hub-b');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'hub.admin.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000009a2', 'hub.mentor.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000009b1', 'hub.admin.b@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('29000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a1', 'admin'),
  ('29000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a2', 'mentor'),
  ('29000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000009b1', 'admin');

select results_eq(
  $$ select module_key, enabled from public.tenant_modules
     where tenant_id = '29000000-0000-0000-0000-00000000000a' order by module_key $$,
  $$ values ('cuidado'::text, true), ('disparador'::text, true), ('pai'::text, true) $$,
  'igreja nova nasce com cuidado, disparador e pai habilitados');

-- A plataforma desliga o PAI na igreja B
update public.tenant_modules set enabled = false
where tenant_id = '29000000-0000-0000-0000-00000000000b' and module_key = 'pai';

-- ===== Mentor da igreja A (o hub lê os módulos com o JWT do usuário) =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000009a2","role":"authenticated"}', true);
select results_eq(
  $$ select m.module_key from public.tenant_memberships tm
     join public.tenants t on t.id = tm.tenant_id
     join public.tenant_modules m on m.tenant_id = t.id
     where tm.user_id = auth.uid() and tm.active and m.enabled order by m.module_key $$,
  array['cuidado', 'disparador', 'pai']::text[],
  'mentor A lê os módulos habilitados da própria igreja (caminho do hub)');
select is_empty(
  $$ select 1 from public.tenant_modules where tenant_id = '29000000-0000-0000-0000-00000000000b' $$,
  'mentor A não vê os módulos da igreja B');
update public.tenant_modules set enabled = false
where tenant_id = '29000000-0000-0000-0000-00000000000a' and module_key = 'disparador';

-- ===== Admin da igreja A também não liga/desliga módulos (é da plataforma) =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000009a1","role":"authenticated"}', true);
update public.tenant_modules set enabled = true
where tenant_id = '29000000-0000-0000-0000-00000000000b' and module_key = 'pai';
select throws_ok(
  $$ insert into public.tenant_modules (tenant_id, module_key) values ('29000000-0000-0000-0000-00000000000a', 'novo') $$,
  '42501', null, 'admin da igreja não cria módulos');

-- ===== Admin da igreja B =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000009b1","role":"authenticated"}', true);
select results_eq(
  $$ select module_key, enabled from public.tenant_modules where module_key in ('pai', 'disparador') order by module_key $$,
  $$ values ('disparador'::text, true), ('pai'::text, false) $$,
  'admin B vê só a igreja B: disparador ligado, pai desligado');

reset role;
select is(
  (select enabled from public.tenant_modules
   where tenant_id = '29000000-0000-0000-0000-00000000000a' and module_key = 'disparador'),
  true, 'mentor não desliga módulo (sem policy de escrita)');
select is(
  (select enabled from public.tenant_modules
   where tenant_id = '29000000-0000-0000-0000-00000000000b' and module_key = 'pai'),
  false, 'admin de outra igreja não religa módulo');
select * from finish();
rollback;
