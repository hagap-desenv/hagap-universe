// Webhook do Disparador: dados fictícios (telefones +55119..., chaves de teste).
import { assertEquals } from "@std/assert";
import { sha256Hex } from "./auth.ts";
import { createWebhookHandler, type InboundRecord, type WebhookInstance } from "./webhook.ts";

const NOW = Date.parse("2026-10-03T15:00:00Z");
const NOW_S = Math.floor(NOW / 1000);
const KEY_A = "chave-webhook-igreja-a";
const KEY_B = "chave-webhook-igreja-b";

// Repositório em memória: o UNIQUE (instance_id, provider_message_id) do banco simulado por um Set
class MemoryRepo {
  records: InboundRecord[] = [];
  private seen = new Set<string>();
  constructor(private instances: Record<string, WebhookInstance>) {}

  findInstanceByName(name: string): Promise<WebhookInstance | null> {
    return Promise.resolve(this.instances[name] ?? null);
  }
  async recordInbound(record: InboundRecord): Promise<boolean> {
    await Promise.resolve();
    const key = `${record.instanceId}:${record.providerMessageId}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.records.push(record);
    return true;
  }
}

async function setup() {
  const repo = new MemoryRepo({
    "inst-a": { id: "inst-a-id", webhook_key_hash: await sha256Hex(KEY_A) },
    "inst-b": { id: "inst-b-id", webhook_key_hash: await sha256Hex(KEY_B) },
    "inst-sem-chave": { id: "inst-c-id", webhook_key_hash: null },
  });
  const handler = createWebhookHandler({ repo, now: () => NOW });
  return { repo, handler };
}

type MsgOpts = {
  id?: string;
  remoteJid?: string;
  fromMe?: boolean;
  senderPn?: string;
  ts?: string | number;
  text?: string;
  extended?: boolean;
};

function messageData(o: MsgOpts = {}) {
  const text = o.text ?? "Estou bem, obrigado";
  return {
    key: {
      remoteJid: o.remoteJid ?? "5511900000001@s.whatsapp.net",
      fromMe: o.fromMe ?? false,
      id: o.id ?? "MSG-1",
      ...(o.senderPn ? { senderPn: o.senderPn } : {}),
    },
    pushName: "Pessoa Teste",
    message: o.extended ? { extendedTextMessage: { text } } : { conversation: text },
    messageType: o.extended ? "extendedTextMessage" : "conversation",
    messageTimestamp: o.ts ?? NOW_S,
  };
}

function upsert(data: unknown, instance = "inst-a") {
  return { event: "messages.upsert", instance, data };
}

function post(
  body: unknown,
  { instance = "inst-a", key = KEY_A }: { instance?: string | null; key?: string | null } = {},
) {
  const url = new URL("https://edge.teste.invalid/functions/v1/disparador-webhook");
  if (instance !== null) url.searchParams.set("instance", instance);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key !== null) headers["x-disparador-key"] = key;
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

async function call(handler: (r: Request) => Promise<Response>, req: Request) {
  const res = await handler(req);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

Deno.test("webhook: mensagem válida é gravada na instância (tenant pela instância)", async () => {
  const { repo, handler } = await setup();

  const { status, json } = await call(handler, post(upsert(messageData())));

  assertEquals(status, 200);
  assertEquals(json.received, 1);
  assertEquals(repo.records, [{
    instanceId: "inst-a-id",
    senderE164: "+5511900000001",
    body: "Estou bem, obrigado",
    providerMessageId: "MSG-1",
    providerTs: new Date(NOW).toISOString(),
  }]);
});

Deno.test("webhook: extendedTextMessage.text também é lido", async () => {
  const { repo, handler } = await setup();
  await call(handler, post(upsert(messageData({ extended: true, text: "Resposta longa" }))));
  assertEquals(repo.records[0].body, "Resposta longa");
});

Deno.test("webhook: mensagem duplicada é gravada uma única vez", async () => {
  const { repo, handler } = await setup();

  const first = await call(handler, post(upsert(messageData({ id: "DUP-1" }))));
  const second = await call(handler, post(upsert(messageData({ id: "DUP-1" }))));

  assertEquals(first.json.received, 1);
  assertEquals(second.status, 200);
  assertEquals(second.json.received, 0);
  assertEquals(second.json.duplicates, 1);
  assertEquals(repo.records.length, 1);
});

Deno.test("webhook: rajada — pedidos concorrentes e lote no mesmo evento", async () => {
  const { repo, handler } = await setup();

  // 10 mensagens distintas + 5 cópias da mesma, todas em paralelo
  const distinct = Array.from(
    { length: 10 },
    (_, i) => call(handler, post(upsert(messageData({ id: `R-${i}` })))),
  );
  const copies = Array.from(
    { length: 5 },
    () => call(handler, post(upsert(messageData({ id: "R-COPIA" })))),
  );
  const results = await Promise.all([...distinct, ...copies]);
  assertEquals(results.every((r) => r.status === 200), true);

  // Lote: data como array
  await call(handler, post(upsert([messageData({ id: "L-1" }), messageData({ id: "L-2" })])));

  assertEquals(repo.records.length, 13);
  assertEquals(repo.records.filter((r) => r.providerMessageId === "R-COPIA").length, 1);
});

Deno.test("webhook: timestamp antigo (string e number) é ignorado — history-sync > 5 min", async () => {
  const { repo, handler } = await setup();
  const old = NOW_S - 6 * 60;

  const asNumber = await call(handler, post(upsert(messageData({ id: "OLD-N", ts: old }))));
  const asString = await call(handler, post(upsert(messageData({ id: "OLD-S", ts: String(old) }))));
  const recentString = await call(
    handler,
    post(upsert(messageData({ id: "NEW-S", ts: String(NOW_S - 60) }))),
  );
  const millis = await call(handler, post(upsert(messageData({ id: "OLD-MS", ts: old * 1000 }))));

  assertEquals(asNumber.json.ignored, 1);
  assertEquals(asString.json.ignored, 1);
  assertEquals(millis.json.ignored, 1);
  assertEquals(recentString.json.received, 1);
  assertEquals(repo.records.map((r) => r.providerMessageId), ["NEW-S"]);
});

Deno.test("webhook: @lid é resolvido por senderPn; sem senderPn é ignorado", async () => {
  const { repo, handler } = await setup();

  await call(
    handler,
    post(upsert(messageData({
      id: "LID-1",
      remoteJid: "123456789012345@lid",
      senderPn: "5511900000002@s.whatsapp.net",
    }))),
  );
  const noPn = await call(
    handler,
    post(upsert(messageData({ id: "LID-2", remoteJid: "123456789012345@lid" }))),
  );

  assertEquals(repo.records.map((r) => r.senderE164), ["+5511900000002"]);
  assertEquals(noPn.json.ignored, 1);
});

Deno.test("webhook: grupos, status e JIDs com device", async () => {
  const { repo, handler } = await setup();

  await call(
    handler,
    post(upsert(messageData({ id: "G-1", remoteJid: "120363000000000000@g.us" }))),
  );
  await call(handler, post(upsert(messageData({ id: "S-1", remoteJid: "status@broadcast" }))));
  await call(
    handler,
    post(upsert(messageData({ id: "D-1", remoteJid: "5511900000003:12@s.whatsapp.net" }))),
  );

  assertEquals(repo.records.map((r) => r.providerMessageId), ["D-1"]);
  assertEquals(repo.records[0].senderE164, "+5511900000003");
});

Deno.test("webhook: chave inválida, ausente ou instância sem chave → 401 e nada gravado", async () => {
  const { repo, handler } = await setup();

  const wrong = await call(handler, post(upsert(messageData()), { key: "chave-errada" }));
  const missing = await call(handler, post(upsert(messageData()), { key: null }));
  const noHash = await call(
    handler,
    post(upsert(messageData(), "inst-sem-chave"), {
      instance: "inst-sem-chave",
      key: "qualquer-chave",
    }),
  );
  const unknown = await call(
    handler,
    post(upsert(messageData(), "inst-x"), { instance: "inst-x", key: KEY_A }),
  );

  assertEquals([wrong.status, missing.status, noHash.status, unknown.status], [401, 401, 401, 401]);
  assertEquals(repo.records.length, 0);
});

Deno.test("webhook: sem ?instance → 400", async () => {
  const { handler } = await setup();
  const { status } = await call(handler, post(upsert(messageData()), { instance: null }));
  assertEquals(status, 400);
});

Deno.test("webhook: instância de outro tenant — chave de B não grava em A, nem payload trocado", async () => {
  const { repo, handler } = await setup();

  const keyOfB = await call(
    handler,
    post(upsert(messageData()), { instance: "inst-a", key: KEY_B }),
  );
  const swapped = await call(
    handler,
    post(upsert(messageData(), "inst-b"), { instance: "inst-a", key: KEY_A }),
  );
  const own = await call(
    handler,
    post(upsert(messageData({ id: "B-1" }), "inst-b"), { instance: "inst-b", key: KEY_B }),
  );

  assertEquals(keyOfB.status, 401);
  assertEquals(swapped.status, 401);
  assertEquals(own.status, 200);
  assertEquals(repo.records.map((r) => r.instanceId), ["inst-b-id"]);
});

Deno.test("webhook: fromMe é ignorado", async () => {
  const { repo, handler } = await setup();
  const { json } = await call(handler, post(upsert(messageData({ fromMe: true }))));
  assertEquals(json.ignored, 1);
  assertEquals(repo.records.length, 0);
});

Deno.test("webhook: opt-out SAIR/PARAR chega ao banco (aplicado em record_inbound)", async () => {
  const { repo, handler } = await setup();

  await call(handler, post(upsert(messageData({ id: "OUT-1", text: "SAIR" }))));
  await call(handler, post(upsert(messageData({ id: "OUT-2", text: " parar. " }))));

  assertEquals(repo.records.map((r) => r.body), ["SAIR", " parar. "]);
});

Deno.test("webhook: outros eventos são aceites e ignorados (200)", async () => {
  const { repo, handler } = await setup();
  const res = await call(
    handler,
    post({ event: "connection.update", instance: "inst-a", data: { state: "open" } }),
  );
  const upper = await call(handler, post({ ...upsert(messageData()), event: "MESSAGES_UPSERT" }));

  assertEquals(res.status, 200);
  assertEquals(upper.json.received, 1);
  assertEquals(repo.records.length, 1);
});

Deno.test("webhook: método ≠ POST → 405; JSON inválido → 400", async () => {
  const { handler } = await setup();
  const get = await call(
    handler,
    new Request("https://edge.teste.invalid/disparador-webhook?instance=inst-a"),
  );
  const bad = await call(
    handler,
    new Request("https://edge.teste.invalid/disparador-webhook?instance=inst-a", {
      method: "POST",
      headers: { "x-disparador-key": KEY_A },
      body: "{nao-e-json",
    }),
  );
  assertEquals(get.status, 405);
  assertEquals(bad.status, 400);
});
