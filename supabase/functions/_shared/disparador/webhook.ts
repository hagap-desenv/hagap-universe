// Webhook de recebimento (Evolution messages.upsert): tenant pela instância, chave da instância,
// dedup no banco, guarda de history-sync, @lid via senderPn, fromMe ignorado.
import { keyMatchesHash } from "./auth.ts";
import type { InstanceStatus } from "./tick.ts";
import { errorLabel } from "./timeout.ts";

export type WebhookInstance = { id: string; webhook_key_hash: string | null };

export type InboundRecord = {
  instanceId: string;
  senderE164: string;
  body: string | null;
  providerMessageId: string;
  providerTs: string | null;
};

export interface WebhookRepo {
  // connection.update: open → open; close → disconnected (motor regista a queda)
  setInstanceStatus(instanceId: string, status: InstanceStatus): Promise<void>;
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

type Json = Record<string, unknown>;
type Parsed = { record: Omit<InboundRecord, "instanceId"> } | { ignored: string };

const E164 = /^\+[1-9][0-9]{7,14}$/;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const asObject = (value: unknown): Json | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Json : null;

// "messages.upsert" (v2) ou "MESSAGES_UPSERT" (webhook por eventos / v1)
function normalizeEvent(event: unknown): string {
  return typeof event === "string" ? event.trim().toLowerCase().replace(/_/g, ".") : "";
}

// JID de pessoa → E.164. Grupos, status, newsletter e @lid → null.
function jidToE164(jid: string): string | null {
  const at = jid.indexOf("@");
  const user = at >= 0 ? jid.slice(0, at) : jid;
  const domain = at >= 0 ? jid.slice(at + 1) : "s.whatsapp.net";
  if (domain !== "s.whatsapp.net" && domain !== "c.us") return null;
  const digits = user.split(":")[0];
  if (!/^[0-9]+$/.test(digits)) return null;
  const e164 = `+${digits}`;
  return E164.test(e164) ? e164 : null;
}

// Timestamp da Evolution: segundos ou milissegundos, string, number ou Long {low, high}
function timestampMs(value: unknown): number | null {
  let n: number;
  const long = asObject(value);
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && value.trim() !== "") n = Number(value);
  else if (long && typeof long.low === "number") {
    n = (typeof long.high === "number" ? long.high : 0) * 2 ** 32 + (long.low >>> 0);
  } else return null;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e12 ? n : n * 1000;
}

function parseMessage(item: unknown, nowMs: number, maxAgeMs: number): Parsed {
  const data = asObject(item);
  const key = asObject(data?.key);
  if (!data || !key) return { ignored: "malformed" };
  if (key.fromMe === true) return { ignored: "from_me" };

  const id = typeof key.id === "string" ? key.id.trim() : "";
  if (!id) return { ignored: "malformed" };

  const remoteJid = typeof key.remoteJid === "string" ? key.remoteJid : "";
  // @lid não é número de telefone: só vale com senderPn; nunca gravar dígitos do LID
  const jid = remoteJid.endsWith("@lid")
    ? (typeof key.senderPn === "string" ? key.senderPn : "")
    : remoteJid;
  const sender = jid ? jidToE164(jid) : null;
  if (!sender) return { ignored: "not_a_person" };

  const ts = timestampMs(data.messageTimestamp);
  if (ts !== null && nowMs - ts > maxAgeMs) return { ignored: "history_sync" };

  const message = asObject(data.message);
  const extended = asObject(message?.extendedTextMessage);
  let text: string | null = null;
  if (typeof message?.conversation === "string") text = message.conversation;
  else if (typeof extended?.text === "string") text = extended.text;

  return {
    record: {
      senderE164: sender,
      body: text,
      providerMessageId: id,
      providerTs: ts === null ? null : new Date(ts).toISOString(),
    },
  };
}

export function createWebhookHandler(deps: WebhookDeps): (req: Request) => Promise<Response> {
  const now = deps.now ?? Date.now;
  const maxAgeMs = deps.maxAgeMs ?? HISTORY_MAX_AGE_MS;

  return async (req) => {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    // Tenant identificado pela instância (?instance=), nunca pelo número do remetente
    const instanceName = new URL(req.url).searchParams.get("instance")?.trim() ?? "";
    if (!instanceName) return json(400, { error: "instance_required" });

    const providedKey = req.headers.get("x-disparador-key");
    if (!providedKey) return json(401, { error: "unauthorized" });

    let instance: WebhookInstance | null;
    try {
      instance = await deps.repo.findInstanceByName(instanceName);
    } catch (error) {
      console.error(`disparador-webhook: falha ao resolver instância (${errorLabel(error)})`);
      return json(500, { error: "lookup_failed" });
    }
    // Mesma resposta para instância desconhecida, sem chave configurada ou chave errada
    if (!instance || !(await keyMatchesHash(providedKey, instance.webhook_key_hash))) {
      return json(401, { error: "unauthorized" });
    }

    let payload: Json | null;
    try {
      payload = asObject(await req.json());
    } catch {
      return json(400, { error: "invalid_json" });
    }
    if (!payload) return json(400, { error: "invalid_json" });

    // O payload não pode falar por outra instância
    if (typeof payload.instance === "string" && payload.instance.trim() !== instanceName) {
      return json(401, { error: "unauthorized" });
    }

    const result = { received: 0, duplicates: 0, ignored: 0 };
    if (normalizeEvent(payload.event) !== "messages.upsert") {
      return json(200, { ...result, ignored: 1 });
    }

    const items = Array.isArray(payload.data) ? payload.data : [payload.data];
    const nowMs = now();
    try {
      for (const item of items) {
        const parsed = parseMessage(item, nowMs, maxAgeMs);
        if ("ignored" in parsed) {
          result.ignored++;
          continue;
        }
        const isNew = await deps.repo.recordInbound({ instanceId: instance.id, ...parsed.record });
        if (isNew) result.received++;
        else result.duplicates++;
      }
    } catch (error) {
      // 5xx → a Evolution reenvia; o dedup no banco evita duplicados
      console.error(`disparador-webhook: falha ao gravar (${errorLabel(error)})`);
      return json(500, { error: "record_failed" });
    }
    return json(200, result);
  };
}
