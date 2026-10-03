-- Guarda genérica: qualquer tabela nova no schema public tem de nascer com RLS ativa.
-- Tabelas com tenant_id têm ainda de ter pelo menos uma policy (RLS sem policy = tabela inacessível por engano).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is_empty(
  $$ select c.relname
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'todas as tabelas de public têm RLS ativa');

select is_empty(
  $$ select c.relname
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
     where n.nspname = 'public' and c.relkind in ('r', 'p')
       and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) $$,
  'todas as tabelas com tenant_id têm policies');

select isnt_empty(
  $$ select 1 from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and a.attname = 'tenant_id' $$,
  'a guarda está a inspecionar tabelas de negócio (há colunas tenant_id)');

-- Prova de que a guarda apanha uma tabela nova sem RLS (desfeito pelo rollback)
create table public._rls_guard_probe (id int, tenant_id uuid);
select isnt_empty(
  $$ select c.relname
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'guarda deteta tabela nova sem RLS');

select * from finish();
rollback;
