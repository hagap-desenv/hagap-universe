// EF disparador-instance-connect: liga uma instância por QR (chamada pelo app apps/disparador).
// verify_jwt=true no gateway + autorização no banco com o JWT do usuário (admin da igreja da instância).
import {
  createConnectHandler,
  createUserAuthorizer,
} from "../_shared/disparador/connect_handler.ts";
import { getProvider } from "../_shared/disparador/provider.ts";
import { defaultProviderFactories } from "../_shared/disparador/providers.ts";
import { createDisparadorRepo } from "../_shared/disparador/repo.ts";
import { createRpcClient } from "../_shared/disparador/rpc.ts";

const env = (key: string) => Deno.env.get(key);
const url = env("SUPABASE_URL") ?? "";

Deno.serve(createConnectHandler({
  authorize: createUserAuthorizer({
    url,
    anonKey: env("SUPABASE_ANON_KEY") ?? env("SUPABASE_PUBLISHABLE_KEY") ?? "",
  }),
  repo: createDisparadorRepo(
    createRpcClient({ url, serviceKey: env("SUPABASE_SERVICE_ROLE_KEY") ?? "" }),
  ),
  provider: () => getProvider(env, defaultProviderFactories),
  // URL do disparador-webhook configurada na Evolution a cada conexão (chave rotacionada)
  webhookBaseUrl: url,
}));
