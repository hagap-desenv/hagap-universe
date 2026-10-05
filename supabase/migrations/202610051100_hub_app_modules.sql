-- Hub (painel de apps): chaves de módulo que liberam cada APP para a igreja em tenant_modules.
--   pai        → acesso ao app PAI (card no hub)
--   disparador → acesso ao app Disparador (card no hub)
--   cuidado    → continua existindo: é o módulo INTERNO do PAI (menu "Cuidado"). NÃO é alias de `pai`.
-- Escrita de tenant_modules segue só da plataforma (service_role / dono); membros só leem (RLS existente).

-- Igreja nova: cuidado (como antes) + pai + disparador ligados
create or replace function public.handle_new_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_modules (tenant_id, module_key, enabled)
  values (new.id, 'cuidado', true), (new.id, 'pai', true), (new.id, 'disparador', true)
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_tenant() from public, anon, authenticated;

-- Igrejas já existentes: registra as duas chaves ligadas (já usavam os dois apps); não mexe em `cuidado`
insert into public.tenant_modules (tenant_id, module_key, enabled)
select t.id, k.module_key, true
from public.tenants t
cross join (values ('pai'), ('disparador')) as k (module_key)
on conflict (tenant_id, module_key) do nothing;
