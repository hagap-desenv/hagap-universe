// Hub: todo membro de igreja vê o painel; os cards dependem de módulo + papel (lib/apps.ts).
import { definePermissions } from "@hagap/core/permissions";

export const hubPermissions = definePermissions(["painel.view"], {
  admin: ["painel.view"],
  coordenador: ["painel.view"],
  mentor: ["painel.view"],
});
