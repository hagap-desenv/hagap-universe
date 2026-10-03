// Handler da EF disparador-instance-connect: ligar instância por QR.
// Autorização com o JWT do próprio usuário (RPC connect_target: admin da igreja da instância);
// estado gravado como motor (service_role). Respostas nunca expõem segredos nem erros do provedor.
import type { MessagingProvider } from "./provider.ts";
import { createRpcClient, RpcError } from "./rpc.ts";
import type { InstanceStatus } from "./tick.ts";
import { errorLabel, withTimeout } from "./timeout.ts";

export type ConnectDecision = { ok: true; instanceName: string } | { ok: false; status: 401 | 403 };
export type ConnectAuthorizer = (
  accessToken: string,
  instanceId: string,
) => Promise<ConnectDecision>;

export type ConnectDeps = {
  authorize: ConnectAuthorizer;
  repo: { setInstanceStatus(id: string, status: InstanceStatus): Promise<void> };
  provider: () => MessagingProvider;
  timeoutMs?: number;
};

export const CONNECT_TIMEOUT_MS = 10_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("Authorization") ?? "");
  return match ? match[1] : null;
}

const STATE_TO_STATUS: Record<string, InstanceStatus> = {
  open: "open",
  connecting: "connecting",
  close: "disconnected",
};

export function createConnectHandler(deps: ConnectDeps): (req: Request) => Promise<Response> {
  const timeoutMs = deps.timeoutMs ?? CONNECT_TIMEOUT_MS;

  return async (req) => {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    const token = bearerToken(req);
    if (!token) return json(401, { error: "unauthorized" });

    let instanceId: unknown;
    try {
      instanceId = ((await req.json()) as { instance_id?: unknown })?.instance_id;
    } catch {
      instanceId = undefined;
    }
    if (typeof instanceId !== "string" || !UUID.test(instanceId)) {
      return json(400, { error: "invalid_instance_id" });
    }

    let decision: ConnectDecision;
    try {
      decision = await deps.authorize(token, instanceId);
    } catch (error) {
      console.error(`disparador-instance-connect: autorização falhou (${errorLabel(error)})`);
      return json(500, { error: "authorization_failed" });
    }
    if (!decision.ok) {
      return json(decision.status, {
        error: decision.status === 401 ? "unauthorized" : "forbidden",
      });
    }

    let status: InstanceStatus;
    let qrCode: string | undefined;
    try {
      const provider = deps.provider();
      const result = await withTimeout(provider.connect(decision.instanceName), timeoutMs);
      if (result.qrCode) {
        status = "connecting";
        qrCode = result.qrCode;
      } else {
        const state = await withTimeout(
          provider.connectionState(decision.instanceName),
          timeoutMs,
        );
        status = STATE_TO_STATUS[state] ?? "disconnected";
      }
    } catch (error) {
      // Só o rótulo (timeout/classe do erro) vai para o log; nada vai para a resposta
      console.error(`disparador-instance-connect: provedor falhou (${errorLabel(error)})`);
      return json(502, { error: "provider_unavailable" });
    }

    try {
      await deps.repo.setInstanceStatus(instanceId, status);
    } catch (error) {
      console.error(`disparador-instance-connect: estado não gravado (${errorLabel(error)})`);
      return json(500, { error: "status_not_saved" });
    }

    return json(200, qrCode ? { status, qr_code: qrCode } : { status });
  };
}

// Autorização pelo PostgREST com o JWT do usuário: valida a assinatura e aplica auth.uid() no banco
export function createUserAuthorizer(options: {
  url: string;
  anonKey: string;
  fetch?: typeof fetch;
}): ConnectAuthorizer {
  return async (accessToken, instanceId) => {
    const rpc = createRpcClient({
      url: options.url,
      serviceKey: options.anonKey,
      bearer: accessToken,
      fetch: options.fetch,
    });
    try {
      const name = await rpc("connect_target", { p_instance_id: instanceId });
      if (typeof name !== "string" || name === "") return { ok: false, status: 403 };
      return { ok: true, instanceName: name };
    } catch (error) {
      if (error instanceof RpcError) {
        if (error.status === 401) return { ok: false, status: 401 };
        if (error.code === "42501" || error.status === 403) return { ok: false, status: 403 };
      }
      throw error;
    }
  };
}
