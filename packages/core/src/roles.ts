// Roles do Universe (enum public.app_role). Pessoa em cuidado não é role: não tem login.
export const APP_ROLES = ["super_admin", "admin", "coordenador", "mentor"] as const;
export type AppRole = (typeof APP_ROLES)[number];
export type TenantRole = Exclude<AppRole, "super_admin">;

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super admin da plataforma",
  admin: "Administrador(a)",
  coordenador: "Coordenador(a)",
  mentor: "Mentor(a)",
};
