// Handler HTTP do disparador-tick (testável sem Deno.serve): auth por x-cron-secret + heartbeat.
import type { MessagingProvider } from "./provider.ts";
import type { TickRepo } from "./tick.ts";

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

export function createTickHandler(_deps: TickHandlerDeps): (req: Request) => Promise<Response> {
  return () => Promise.reject(new Error("not implemented"));
}
