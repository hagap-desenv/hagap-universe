// Catálogo de apps do hub: cada app exige um módulo habilitado na igreja ativa (tenant_modules) e um papel.
// super_admin da plataforma vê todos. A autorização real continua em cada app (RLS + requirePermission).
import type { AppRole, TenantRole } from "./roles";

export type AppEntry = {
  key: string;
  name: string;
  description: string;
  module: string;
  roles: readonly TenantRole[];
  url: string | undefined;
};

export function visibleApps(
  catalog: readonly AppEntry[],
  ctx: { role: AppRole | null | undefined; modules: readonly string[] },
): AppEntry[] {
  const { role } = ctx;
  if (!role) return [];
  if (role === "super_admin") return [...catalog];
  return catalog.filter((app) => ctx.modules.includes(app.module) && app.roles.includes(role));
}
