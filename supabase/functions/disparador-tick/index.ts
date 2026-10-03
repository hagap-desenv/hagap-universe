// EF disparador-tick: chamada pelo pg_cron a cada minuto (header x-cron-secret).
// verify_jwt=false em config.toml; autenticação feita no handler.
import { getProvider } from "../_shared/disparador/provider.ts";
import { defaultProviderFactories } from "../_shared/disparador/providers.ts";
import { createDisparadorRepo } from "../_shared/disparador/repo.ts";
import { createRpcClient } from "../_shared/disparador/rpc.ts";
import { createTickHandler } from "../_shared/disparador/tick_handler.ts";

const env = (key: string) => Deno.env.get(key);

const rpc = createRpcClient({
  url: env("SUPABASE_URL") ?? "",
  serviceKey: env("SUPABASE_SERVICE_ROLE_KEY") ?? "",
});

Deno.serve(createTickHandler({
  cronSecret: env("DISPARADOR_CRON_SECRET"),
  repo: createDisparadorRepo(rpc),
  provider: () => getProvider(env, defaultProviderFactories),
}));
