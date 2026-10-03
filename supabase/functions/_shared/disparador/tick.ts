// Tick do motor de envio (lógica pura): health-check → claim → envio único → mark_sent/mark_failed.
import type { MessagingProvider } from "./provider.ts";

export type InstanceStatus = "disconnected" | "connecting" | "open";
export type DispatchableInstance = { id: string; name: string };
export type ClaimedMessage = { id: string; recipient_e164: string; body: string };

export interface TickRepo {
  listDispatchableInstances(): Promise<DispatchableInstance[]>;
  setInstanceStatus(instanceId: string, status: InstanceStatus): Promise<void>;
  claimNext(instanceId: string): Promise<ClaimedMessage | null>;
  markSent(messageId: string, providerMessageId: string): Promise<void>;
  markFailed(messageId: string, error: string): Promise<void>;
}

export type TickOptions = { timeoutMs?: number };

export type TickSummary = {
  instances: number;
  sent: number;
  failed: number;
  disconnected: number;
  idle: number;
  errors: number;
};

export const SEND_TIMEOUT_MS = 10_000;

export function runTick(
  _repo: TickRepo,
  _provider: MessagingProvider,
  _options: TickOptions = {},
): Promise<TickSummary> {
  return Promise.reject(new Error("not implemented"));
}
