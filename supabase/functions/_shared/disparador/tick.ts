// Tick do motor de envio (lógica pura): health-check → claim → envio único → mark_sent/mark_failed.
import type { MessagingProvider } from "./provider.ts";
import { errorLabel, withTimeout } from "./timeout.ts";

export type InstanceStatus = "disconnected" | "connecting" | "open";
export type DispatchableInstance = { id: string; name: string };
export type ClaimedMessage = { id: string; recipient_e164: string; body: string };

export interface TickRepo {
  // sending antigo → failed/unknown_outcome (nunca reenvia); devolve quantas
  reapStuckSending(): Promise<number>;
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
  connecting: number;
  idle: number;
  errors: number;
  reaped: number;
};

export const SEND_TIMEOUT_MS = 10_000;

type Outcome = "sent" | "failed" | "disconnected" | "connecting" | "idle" | "errors";

// Cada instância é tratada uma única vez por tick (no máximo 1 envio); instâncias diferentes em paralelo.
export async function runTick(
  repo: TickRepo,
  provider: MessagingProvider,
  options: TickOptions = {},
): Promise<TickSummary> {
  const timeoutMs = options.timeoutMs ?? SEND_TIMEOUT_MS;

  // 0) Varredura de presos em sending: falha aqui não impede o envio deste tick
  let reaped = 0;
  let reapErrors = 0;
  try {
    reaped = await repo.reapStuckSending();
  } catch (error) {
    reapErrors = 1;
    console.error(`disparador-tick: varredura falhou (${errorLabel(error)})`);
  }

  const listed = await repo.listDispatchableInstances();
  const instances = [...new Map(listed.map((i) => [i.id, i])).values()];

  const outcomes = await Promise.all(
    instances.map((instance) =>
      processInstance(repo, provider, instance, timeoutMs).catch((): Outcome => {
        console.error(`disparador-tick: erro de repositório na instância ${instance.id}`);
        return "errors";
      })
    ),
  );

  const summary: TickSummary = {
    instances: instances.length,
    sent: 0,
    failed: 0,
    disconnected: 0,
    connecting: 0,
    idle: 0,
    errors: reapErrors,
    reaped,
  };
  for (const outcome of outcomes) summary[outcome]++;
  return summary;
}

async function processInstance(
  repo: TickRepo,
  provider: MessagingProvider,
  instance: DispatchableInstance,
  timeoutMs: number,
): Promise<Outcome> {
  // 1) Health-check ANTES do claim: sem resposta/erro → não envia nem muda estado
  let state;
  try {
    state = await withTimeout(provider.connectionState(instance.name), timeoutMs);
  } catch (error) {
    console.error(`disparador-tick: health-check falhou (${errorLabel(error)}) em ${instance.id}`);
    return "errors";
  }
  // connecting é transitório: não envia nem marca queda. Só close desconecta (e gera evento de queda no banco).
  if (state === "connecting") return "connecting";
  if (state !== "open") {
    await repo.setInstanceStatus(instance.id, "disconnected");
    return "disconnected";
  }

  // 2) Claim: janela local, cap diário e intervalo decididos no banco
  const message = await repo.claimNext(instance.id);
  if (!message) return "idle";

  // 3) Envio único, timeout, sem retry (evita duplicado). Falha no mark_sent não vira mark_failed.
  let providerMessageId: string;
  try {
    const result = await withTimeout(
      provider.sendText(instance.name, message.recipient_e164, message.body),
      timeoutMs,
    );
    providerMessageId = result.providerMessageId;
  } catch (error) {
    await repo.markFailed(message.id, errorLabel(error));
    return "failed";
  }
  await repo.markSent(message.id, providerMessageId);
  return "sent";
}
