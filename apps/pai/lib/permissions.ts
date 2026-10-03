// Matriz de permissões do PAI (herdada do SEPAL, sem `missionario`: pessoa em cuidado não tem login).
import { definePermissions } from "@hagap/core/permissions";

export const PAI_PERMISSIONS = [
  "inicio.view",
  "cuidado.view",
  "equipe.view",
  "admin.view",
  "tenant.configure",
] as const;

export type PaiPermission = (typeof PAI_PERMISSIONS)[number];

export const paiPermissions = definePermissions(PAI_PERMISSIONS, {
  admin: ["inicio.view", "cuidado.view", "equipe.view", "admin.view", "tenant.configure"],
  coordenador: ["inicio.view", "cuidado.view", "equipe.view"],
  // Mentor não vê a área administrativa
  mentor: ["inicio.view", "cuidado.view"],
});

export type NavEntry = { href: string; label: string; permission: PaiPermission; module?: string };

export const PAI_NAV: readonly NavEntry[] = [
  { href: "/", label: "Início", permission: "inicio.view" },
  { href: "/cuidado", label: "Cuidado", permission: "cuidado.view", module: "cuidado" },
  { href: "/admin", label: "Administração", permission: "admin.view" },
];
