import { assertEquals } from "@std/assert";
import { engineServiceKey } from "./rpc.ts";

const envOf = (vars: Record<string, string>) => (name: string) => vars[name];

Deno.test("engineServiceKey prefere a secret key nova do motor", () => {
  assertEquals(
    engineServiceKey(
      envOf({ DISPARADOR_SERVICE_KEY: "nova", SUPABASE_SERVICE_ROLE_KEY: "legada" }),
    ),
    "nova",
  );
});

Deno.test("engineServiceKey usa a legada só como fallback (local/CI)", () => {
  assertEquals(engineServiceKey(envOf({ SUPABASE_SERVICE_ROLE_KEY: "legada" })), "legada");
});

Deno.test("engineServiceKey ignora valor vazio e devolve vazio sem nenhuma chave", () => {
  assertEquals(
    engineServiceKey(envOf({ DISPARADOR_SERVICE_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "legada" })),
    "legada",
  );
  assertEquals(engineServiceKey(envOf({})), "");
});
