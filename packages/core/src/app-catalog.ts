// A implementar (TDD): catálogo de apps do hub e visibilidade por módulo da igreja + papel.
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
  _catalog: readonly AppEntry[],
  _ctx: { role: AppRole | null | undefined; modules: readonly string[] },
): AppEntry[] {
  throw new Error("not implemented");
}
