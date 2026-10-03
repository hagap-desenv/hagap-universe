-- Fundação multi-tenant: funções de autorização, RLS em todas as tabelas e RPC de configuração.

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and global_role = 'super_admin'
  );
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and active
  );
$$;

create or replace function public.has_tenant_role(p_tenant_id uuid, p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and active and role = any (p_roles)
  );
$$;

-- Dois utilizadores partilham pelo menos uma igreja ativa
create or replace function public.shares_tenant_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships mine
    join public.tenant_memberships theirs on theirs.tenant_id = mine.tenant_id
    where mine.user_id = auth.uid() and mine.active
      and theirs.user_id = p_user_id and theirs.active
  );
$$;

revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.is_tenant_member(uuid) from public, anon;
revoke execute on function public.has_tenant_role(uuid, public.app_role[]) from public, anon;
revoke execute on function public.shares_tenant_with(uuid) from public, anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.has_tenant_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.shares_tenant_with(uuid) to authenticated;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_modules enable row level security;

-- tenants: leitura por membros; escrita só via RPC (sem policies de escrita)
create policy tenants_select on public.tenants
  for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(id));

-- profiles: o próprio, colegas de igreja e super_admin
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_super_admin() or public.shares_tenant_with(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Só o nome é editável pelo próprio; global_role nunca pelo cliente
revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- memberships: leitura por membros; gestão por admin da igreja ou super_admin
create policy tenant_memberships_select on public.tenant_memberships
  for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));

create policy tenant_memberships_insert on public.tenant_memberships
  for insert to authenticated
  with check (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin']::public.app_role[]));

create policy tenant_memberships_update on public.tenant_memberships
  for update to authenticated
  using (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin']::public.app_role[]))
  with check (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin']::public.app_role[]));

create policy tenant_memberships_delete on public.tenant_memberships
  for delete to authenticated
  using (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin']::public.app_role[]));

-- módulos: leitura por membros; ativação de módulos fica com a plataforma (service_role)
create policy tenant_modules_select on public.tenant_modules
  for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));

-- Configuração da igreja: só admin da própria igreja ou super_admin
create or replace function public.set_tenant_settings(p_tenant_id uuid, p_name text, p_timezone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_super_admin()
          or public.has_tenant_role(p_tenant_id, array['admin']::public.app_role[])) then
    raise exception 'sem permissão para configurar esta igreja' using errcode = '42501';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'nome obrigatório' using errcode = '22023';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'fuso horário inválido' using errcode = '22023';
  end if;

  update public.tenants
  set name = btrim(p_name), timezone = p_timezone
  where id = p_tenant_id;
end;
$$;

revoke execute on function public.set_tenant_settings(uuid, text, text) from public, anon;
grant execute on function public.set_tenant_settings(uuid, text, text) to authenticated;
