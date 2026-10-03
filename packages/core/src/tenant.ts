// Tenant ativo: o cookie é só uma preferência; vale apenas se a igreja estiver nas memberships
// carregadas do banco (RLS). Cookie forjado/obsoleto → ignorado. Puro e testável.
import type { AppRole } from "./roles";

export type TenantMembership = {
  tenantId: string;
  name: string;
  cnpj: string;
  slug: string;
  timezone: string;
  role: AppRole;
  modules: string[];
};

export function resolveActiveTenant(
  memberships: readonly TenantMembership[],
  cookieValue: string | null | undefined,
): TenantMembership | null {
  if (memberships.length === 0) return null;
  const fromCookie = cookieValue
    ? memberships.find((m) => m.tenantId === cookieValue)
    : undefined;
  return fromCookie ?? memberships[0];
}

export function isMemberOf(
  memberships: readonly TenantMembership[],
  tenantId: string | null | undefined,
): boolean {
  return !!tenantId && memberships.some((m) => m.tenantId === tenantId);
}

// Só caminhos internos (evita open redirect: //host, /\host, esquemas)
export function safeRedirectPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(next)) return fallback;
  return next;
}

export function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
