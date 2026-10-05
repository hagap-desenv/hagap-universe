// Contexto de acesso no servidor: usuário (validado no Auth), memberships (via RLS), tenant ativo
// (cookie validado contra as memberships) e permissões do app. Uma instância por app.
import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { sharedCookieDomain, withSharedDomain } from "./cookies";
import type { Permissions } from "./permissions";
import { isAppRole, type AppRole } from "./roles";
import { createServerSupabase, type ServerSupabase } from "./supabase/server";
import { isMemberOf, resolveActiveTenant, type TenantMembership } from "./tenant";

export type AccessContext<P extends string> = {
  user: { id: string; email: string | null };
  isSuperAdmin: boolean;
  memberships: TenantMembership[];
  active: TenantMembership | null;
  permissions: P[];
};

export type TenantAccessContext<P extends string> = AccessContext<P> & { active: TenantMembership };

type TenantRow = {
  id: string;
  name: string;
  cnpj: string;
  slug: string;
  timezone: string;
  status: string;
  tenant_modules?: { module_key: string; enabled: boolean }[] | null;
};

function toMembership(tenant: TenantRow, role: AppRole): TenantMembership {
  return {
    tenantId: tenant.id,
    name: tenant.name,
    cnpj: tenant.cnpj,
    slug: tenant.slug,
    timezone: tenant.timezone,
    role,
    modules: (tenant.tenant_modules ?? []).filter((m) => m.enabled).map((m) => m.module_key),
  };
}

const TENANT_COLUMNS = "id, name, cnpj, slug, timezone, status, tenant_modules(module_key, enabled)";

// Só leituras com o JWT do usuário: o RLS garante que nenhuma igreja alheia aparece
async function loadMemberships(
  supabase: ServerSupabase,
  userId: string,
): Promise<{ memberships: TenantMembership[]; isSuperAdmin: boolean }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("global_role")
    .eq("id", userId)
    .maybeSingle();
  const isSuperAdmin = profile?.global_role === "super_admin";

  if (isSuperAdmin) {
    const { data, error } = await supabase.from("tenants").select(TENANT_COLUMNS).order("name");
    if (error) throw new Error(`falha ao carregar igrejas (${error.code})`);
    const memberships = ((data ?? []) as TenantRow[])
      .filter((t) => t.status === "active")
      .map((t) => toMembership(t, "super_admin"));
    return { memberships, isSuperAdmin };
  }

  const { data, error } = await supabase
    .from("tenant_memberships")
    .select(`role, tenants!inner(${TENANT_COLUMNS})`)
    .eq("user_id", userId)
    .eq("active", true);
  if (error) throw new Error(`falha ao carregar memberships (${error.code})`);

  const rows = (data ?? []) as unknown as { role: unknown; tenants: TenantRow | TenantRow[] }[];
  const memberships = rows
    .flatMap((row) => {
      const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
      if (!tenant || tenant.status !== "active" || !isAppRole(row.role)) return [];
      return [toMembership(tenant, row.role)];
    })
    .sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
  return { memberships, isSuperAdmin };
}

export type AccessOptions<P extends string> = {
  /** Cookie do tenant ativo (um por app, ex.: `pai_tenant`). */
  cookieName: string;
  permissions: Permissions<P>;
  loginPath?: string;
};

export function createAccess<P extends string>(options: AccessOptions<P>) {
  const loginPath = options.loginPath ?? "/login";

  // Memoizado por request (React cache)
  const getAccess = cache(async (): Promise<AccessContext<P> | null> => {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;

    const { memberships, isSuperAdmin } = await loadMemberships(supabase, user.id);
    const cookieStore = await cookies();
    const active = resolveActiveTenant(memberships, cookieStore.get(options.cookieName)?.value);
    return {
      user: { id: user.id, email: user.email ?? null },
      isSuperAdmin,
      memberships,
      active,
      permissions: options.permissions.permissionsFor(active?.role),
    };
  });

  async function requireAccess(): Promise<AccessContext<P>> {
    const access = await getAccess();
    if (!access) redirect(loginPath);
    return access;
  }

  async function requireTenant(): Promise<TenantAccessContext<P>> {
    const access = await requireAccess();
    if (!access.active) notFound();
    return access as TenantAccessContext<P>;
  }

  // Guard de servidor: sem a permissão no tenant ativo → 404 (não revela a existência da área)
  async function requirePermission(permission: P): Promise<TenantAccessContext<P>> {
    const access = await requireTenant();
    if (!options.permissions.can(access.active.role, permission)) notFound();
    return access;
  }

  // Grava o tenant ativo só se for uma igreja do usuário (validação no servidor)
  async function setActiveTenant(tenantId: unknown): Promise<boolean> {
    const access = await requireAccess();
    if (typeof tenantId !== "string" || !isMemberOf(access.memberships, tenantId)) return false;
    const cookieStore = await cookies();
    // Com AUTH_COOKIE_DOMAIN o cookie vale nos subdomínios (cada app tem o seu nome de cookie)
    cookieStore.set(options.cookieName, tenantId, withSharedDomain({
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: process.env.NODE_ENV === "production" && process.env.HAGAP_INSECURE_COOKIES !== "1",
      maxAge: 60 * 60 * 24 * 180,
    }, sharedCookieDomain()));
    return true;
  }

  return { getAccess, requireAccess, requireTenant, requirePermission, setActiveTenant, cookieName: options.cookieName };
}
