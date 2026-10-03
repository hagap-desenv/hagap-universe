// Webhook de recebimento (Evolution messages.upsert): tenant pela instância, chave da instância,
// dedup no banco, guarda de history-sync, @lid via senderPn, fromMe ignorado.

export type WebhookInstance = { id: string; webhook_key_hash: string | null };

export type InboundRecord = {
  instanceId: string;
  senderE164: string;
  body: string | null;
  providerMessageId: string;
  providerTs: string | null;
};

export interface WebhookRepo {
  findInstanceByName(name: string): Promise<WebhookInstance | null>;
  // true = mensagem nova; false = duplicada (já processada)
  recordInbound(record: InboundRecord): Promise<boolean>;
}

export type WebhookDeps = {
  repo: WebhookRepo;
  now?: () => number;
  maxAgeMs?: number;
};

export const HISTORY_MAX_AGE_MS = 5 * 60 * 1000;

export function createWebhookHandler(_deps: WebhookDeps): (req: Request) => Promise<Response> {
  return () => Promise.reject(new Error("not implemented"));
}
