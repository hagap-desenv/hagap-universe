// EF disparador-webhook: recebe eventos da Evolution (messages.upsert).
// URL configurada na instância: .../disparador-webhook?instance=<nome>, header x-disparador-key.
// verify_jwt=false em config.toml; autenticação pela chave da instância (sha256 no banco).
import { createDisparadorRepo } from "../_shared/disparador/repo.ts";
import { createRpcClient } from "../_shared/disparador/rpc.ts";
import { createWebhookHandler } from "../_shared/disparador/webhook.ts";

const rpc = createRpcClient({
  url: Deno.env.get("SUPABASE_URL") ?? "",
  serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
});

Deno.serve(createWebhookHandler({ repo: createDisparadorRepo(rpc) }));
