-- Fundação multi-tenant: roles, tenants (CNPJ validado), perfis, memberships e módulos.

create type public.app_role as enum ('super_admin', 'admin', 'coordenador', 'mentor');
create type public.tenant_status as enum ('active', 'suspended');

-- CNPJ: exatamente 14 dígitos (sem máscara), não repetidos, dígitos verificadores válidos.
create or replace function public.is_valid_cnpj(p_cnpj text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  w1 int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  w2 int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  s int;
  r int;
  d1 int;
  d2 int;
begin
  if p_cnpj is null or p_cnpj !~ '^[0-9]{14}$' or p_cnpj ~ '^(.)\1{13}$' then
    return false;
  end if;

  s := 0;
  for i in 1..12 loop
    s := s + substr(p_cnpj, i, 1)::int * w1[i];
  end loop;
  r := s % 11;
  d1 := case when r < 2 then 0 else 11 - r end;

  s := 0;
  for i in 1..13 loop
    s := s + substr(p_cnpj, i, 1)::int * w2[i];
  end loop;
  r := s % 11;
  d2 := case when r < 2 then 0 else 11 - r end;

  return d1 = substr(p_cnpj, 13, 1)::int and d2 = substr(p_cnpj, 14, 1)::int;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Igreja = tenant
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text not null unique constraint tenants_cnpj_valid check (public.is_valid_cnpj(cnpj)),
  slug text not null unique constraint tenants_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone text not null default 'America/Sao_Paulo',
  status public.tenant_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Utilizador do portal (pessoa em cuidado não tem login nem perfil aqui)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  global_role public.app_role
    constraint profiles_global_role_only_super check (global_role is null or global_role = 'super_admin'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null
    constraint tenant_memberships_no_super check (role <> 'super_admin'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index tenant_memberships_user_idx on public.tenant_memberships (user_id) where active;

create table public.tenant_modules (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  module_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, module_key)
);

create trigger tenants_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger tenant_memberships_updated_at before update on public.tenant_memberships
  for each row execute function public.set_updated_at();
create trigger tenant_modules_updated_at before update on public.tenant_modules
  for each row execute function public.set_updated_at();

-- Perfil criado automaticamente para cada novo utilizador do Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Módulo base ligado por defeito em cada nova igreja
create or replace function public.handle_new_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_modules (tenant_id, module_key, enabled)
  values (new.id, 'cuidado', true)
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_tenant_created after insert on public.tenants
  for each row execute function public.handle_new_tenant();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_tenant() from public, anon, authenticated;
