-- Guarda genérica: qualquer tabela nova num schema de negócio (public, disparador, ...) tem de nascer com RLS ativa.
-- Tabelas com tenant_id têm ainda de ter pelo menos uma policy (RLS sem policy = tabela inacessível por engano).
-- Schemas de negócio = todos menos os do Postgres/Supabase listados em app_schemas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create temporary view app_tables as
  select n.nspname as schema_name, c.relname as table_name, c.oid, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and n.nspname not like 'pg\_%'
    and n.nspname not like '\_%'
    and n.nspname not like 'supabase\_%'
    and n.nspname not in (
      'information_schema', 'auth', 'storage', 'extensions', 'realtime', 'graphql', 'graphql_public',
      'net', 'pgsodium', 'pgsodium_masks', 'vault', 'cron', 'pgbouncer', 'pgtle', 'pgmq', 'tests'
    );

select is_empty(
  $$ select schema_name || '.' || table_name from app_tables where not relrowsecurity $$,
  'todas as tabelas de negócio têm RLS ativa');

select is_empty(
  $$ select t.schema_name || '.' || t.table_name
     from app_tables t
     join pg_attribute a on a.attrelid = t.oid and a.attname = 'tenant_id' and not a.attisdropped
     where not exists (
       select 1 from pg_policies p where p.schemaname = t.schema_name and p.tablename = t.table_name
     ) $$,
  'todas as tabelas com tenant_id têm policies');

select isnt_empty(
  $$ select 1 from app_tables t
     join pg_attribute a on a.attrelid = t.oid and a.attname = 'tenant_id' $$,
  'a guarda está a inspecionar tabelas de negócio (há colunas tenant_id)');

-- Provas de que a guarda apanha tabelas novas sem RLS (desfeitas pelo rollback)
create table public._rls_guard_probe (id int, tenant_id uuid);
select isnt_empty(
  $$ select 1 from app_tables where table_name = '_rls_guard_probe' and not relrowsecurity $$,
  'guarda deteta tabela nova sem RLS em public');

create schema rls_guard_probe_schema;
create table rls_guard_probe_schema.probe (id int, tenant_id uuid);
select isnt_empty(
  $$ select 1 from app_tables where schema_name = 'rls_guard_probe_schema' and not relrowsecurity $$,
  'guarda deteta tabela nova sem RLS noutro schema de negócio');

select * from finish();
rollback;
