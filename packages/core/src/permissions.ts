// Matriz genérica role → permissões. Cada app define as suas permissões; o core só aplica.
// Puro (sem Next/React): testável com node:test e utilizável no servidor e no cliente.
import type { AppRole, TenantRole } from "./roles";

export type PermissionMatrix<P extends string> = Record<TenantRole, readonly P[]>;

export type Permissions<P extends string> = {
  readonly all: readonly P[];
  can(role: AppRole | null | undefined, permission: P): boolean;
  permissionsFor(role: AppRole | null | undefined): P[];
};

export function definePermissions<const P extends string>(
  all: readonly P[],
  matrix: PermissionMatrix<P>,
): Permissions<P> {
  for (const [role, perms] of Object.entries(matrix) as [TenantRole, readonly P[]][]) {
    for (const perm of perms) {
      if (!all.includes(perm)) {
        throw new Error(`permissão desconhecida "${perm}" na role ${role}`);
      }
    }
  }

  const permissionsFor = (role: AppRole | null | undefined): P[] => {
    if (!role) return [];
    // super_admin da plataforma tem tudo; nunca é membership de igreja
    if (role === "super_admin") return [...all];
    return [...(matrix[role] ?? [])];
  };

  return {
    all,
    can: (role, permission) => permissionsFor(role).includes(permission),
    permissionsFor,
  };
}
