// Catálogo de apps do hub. URL de cada app vem de variável de ambiente (por ambiente, nunca no código).
// module = chave em tenant_modules que libera o app na igreja; roles = papéis que veem o card.
import type { AppEntry } from "@hagap/core/app-catalog";

export const APP_CATALOG: readonly AppEntry[] = [
  {
    key: "disparador",
    name: "Disparador",
    description: "Comunicação e relacionamento via WhatsApp",
    module: "disparador",
    roles: ["admin", "coordenador", "mentor"],
    url: process.env.NEXT_PUBLIC_APP_DISPARADOR_URL,
  },
  {
    key: "pai",
    name: "PAI",
    description: "Cuidado pastoral e mentoria",
    module: "pai",
    roles: ["admin", "coordenador", "mentor"],
    url: process.env.NEXT_PUBLIC_APP_PAI_URL,
  },
];
