// Cliente mínimo de RPC PostgREST (sem SDK) para o schema `disparador`, como service_role.

export type RpcClient = (fn: string, args?: Record<string, unknown>) => Promise<unknown>;

export class RpcError extends Error {
  constructor(readonly fn: string, readonly status: number, readonly code: string | undefined) {
    // Só função, HTTP e código: o texto do PostgREST pode ecoar dados pessoais
    super(`rpc ${fn} falhou: HTTP ${status}${code ? ` (${code})` : ""}`);
    this.name = "RpcError";
  }
}

export type RpcOptions = {
  url: string;
  serviceKey: string;
  schema?: string;
  fetch?: typeof fetch;
  // JWT do usuário (chamadas com RLS/auth.uid()); por omissão, a própria serviceKey
  bearer?: string;
};

export function createRpcClient(options: RpcOptions): RpcClient {
  const base = options.url.replace(/\/+$/, "");
  const schema = options.schema ?? "disparador";
  const doFetch = options.fetch ?? fetch;

  return async (fn, args = {}) => {
    if (!base || !options.serviceKey) {
      throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes");
    }
    const res = await doFetch(`${base}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "apikey": options.serviceKey,
        "Authorization": `Bearer ${options.bearer ?? options.serviceKey}`,
        "Content-Type": "application/json",
        "Content-Profile": schema,
        "Accept-Profile": schema,
      },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    if (!res.ok) {
      let code: string | undefined;
      try {
        code = (JSON.parse(text) as { code?: string }).code;
      } catch {
        code = undefined;
      }
      throw new RpcError(fn, res.status, code);
    }
    return text.trim() === "" ? null : JSON.parse(text);
  };
}
