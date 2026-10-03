// Matriz de permissões do Disparador. Espelha as policies do schema `disparador`:
// instâncias só admin; contatos e variações admin/coordenador; leitura para membros.
import { definePermissions } from "@hagap/core/permissions";

export const DISPARADOR_PERMISSIONS = [
  "instancias.view",
  "instancias.manage",
  "contatos.view",
  "contatos.manage",
  "variacoes.view",
  "variacoes.manage",
] as const;

export type DisparadorPermission = (typeof DISPARADOR_PERMISSIONS)[number];

export const disparadorPermissions = definePermissions(DISPARADOR_PERMISSIONS, {
  admin: [...DISPARADOR_PERMISSIONS],
  coordenador: ["instancias.view", "contatos.view", "contatos.manage", "variacoes.view", "variacoes.manage"],
  mentor: ["instancias.view", "contatos.view", "variacoes.view"],
});

export const DISPARADOR_NAV: readonly { href: string; label: string; permission: DisparadorPermission }[] = [
  { href: "/", label: "Instâncias", permission: "instancias.view" },
  { href: "/contatos", label: "Contatos", permission: "contatos.view" },
  { href: "/variacoes", label: "Variações de mensagem", permission: "variacoes.view" },
];
