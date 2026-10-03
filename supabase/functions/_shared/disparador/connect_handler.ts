// Handler da EF disparador-instance-connect (ligar instância por QR). A implementar (TDD).
import type { MessagingProvider } from "./provider.ts";
import type { InstanceStatus } from "./tick.ts";

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

export function createConnectHandler(_deps: ConnectDeps): (req: Request) => Promise<Response> {
  return () => Promise.reject(new Error("not implemented"));
}

export function createUserAuthorizer(_options: {
  url: string;
  anonKey: string;
  fetch?: typeof fetch;
}): ConnectAuthorizer {
  return () => Promise.reject(new Error("not implemented"));
}
