// Handler HTTP do disparador-tick (testável sem Deno.serve): auth por x-cron-secret + heartbeat.
import { secretMatches } from "./auth.ts";
import type { MessagingProvider } from "./provider.ts";
import { runTick, type TickRepo } from "./tick.ts";
import { errorLabel } from "./timeout.ts";

export interface HeartbeatRepo {
  touchHeartbeat(job: string, status: string, detail: Record<string, unknown>): Promise<void>;
}

export type TickHandlerDeps = {
  cronSecret: string | undefined;
  repo: TickRepo & HeartbeatRepo;
  provider: () => MessagingProvider;
  timeoutMs?: number;
};

export const TICK_JOB = "disparador-tick";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export function createTickHandler(deps: TickHandlerDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    // Falha fechada: sem segredo configurado ninguém executa o tick
    if (!deps.cronSecret) return json(500, { error: "not_configured" });
    if (!(await secretMatches(req.headers.get("x-cron-secret"), deps.cronSecret))) {
      return json(401, { error: "unauthorized" });
    }

    let providerName = "unknown";
    let status = "error";
    let detail: Record<string, unknown> = {};
    try {
      const provider = deps.provider();
      providerName = provider.name;
      const summary = await runTick(deps.repo, provider, { timeoutMs: deps.timeoutMs });
      status = summary.errors > 0 ? "partial" : "ok";
      detail = summary;
      return json(200, summary);
    } catch (error) {
      detail = { error: errorLabel(error) };
      return json(500, { error: "tick_failed" });
    } finally {
      try {
        await deps.repo.touchHeartbeat(TICK_JOB, status, { provider: providerName, ...detail });
      } catch (error) {
        console.error(`disparador-tick: heartbeat falhou (${errorLabel(error)})`);
      }
    }
  };
}
