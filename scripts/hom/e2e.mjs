// Validação ponta a ponta do HOM com usuários fictícios (seed HOM). Imprime só PASS/FAIL.
// Env: HOM_SUPABASE_URL, HOM_PUBLISHABLE_KEY, HOM_USERS_FILE (arquivo fora do repo com *_EMAIL/*_SENHA).
import { readFileSync } from "node:fs";

const U = process.env.HOM_SUPABASE_URL;
const PK = process.env.HOM_PUBLISHABLE_KEY;
const creds = Object.fromEntries(
  readFileSync(process.env.HOM_USERS_FILE, "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); if (!ok) fails++; };

async function login(key) {
  const r = await fetch(`${U}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: PK, "Content-Type": "application/json" },
    body: JSON.stringify({ email: creds[`${key}_EMAIL`], password: creds[`${key}_SENHA`] }),
  });
  const j = await r.json();
  return j.access_token;
}
const rest = (jwt, schema = "public") => async (method, path, body) => {
  const h = { apikey: PK, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };
  if (schema !== "public") { h["Accept-Profile"] = schema; h["Content-Profile"] = schema; }
  const r = await fetch(`${U}/rest/v1/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let j; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
};

const A = await login("ADMIN_A"), B = await login("ADMIN_B"), MA = await login("MENTOR_A");
check("login admin A, admin B e mentor A", !!A && !!B && !!MA);

// Isolamento
const tA = await rest(A)("GET", "tenants?select=slug");
check("admin A só vê a igreja A", tA.status === 200 && tA.body.length === 1 && tA.body[0].slug === "igreja-ficticia-a");
const tB = await rest(B)("GET", "tenants?select=slug");
check("admin B só vê a igreja B", tB.status === 200 && tB.body.length === 1 && tB.body[0].slug === "igreja-ficticia-b");
const iA = await rest(A, "disparador")("GET", "instances?select=name");
check("admin A só vê a instância A", iA.status === 200 && iA.body.length === 1 && iA.body[0].name === "hom-ficticia-a");
const cB = await rest(A, "disparador")("GET", "contacts?select=phone_e164&tenant_id=eq.b0000000-0000-0000-0000-00000000000b");
check("admin A não vê contatos da igreja B", cB.status === 200 && cB.body.length === 0);

// Mentor não enfileira
const enqArgs = (name, phone) => ({
  p_instance_id: "a1000000-0000-0000-0000-00000000000a", p_recipient_e164: phone, p_recipient_name: name,
  p_product: "pai", p_variant_group_id: "a2000000-0000-0000-0000-00000000000a",
});
const m = await rest(MA, "disparador")("POST", "rpc/enqueue_message", enqArgs("Contato Fictício A1", "+5511900001001"));
check("mentor A não enfileira", m.status === 403 || m.body?.code === "42501", `HTTP ${m.status}`);

// Admin B não enfileira na instância da igreja A
const x = await rest(B, "disparador")("POST", "rpc/enqueue_message", enqArgs("Contato Fictício A1", "+5511900001001"));
check("admin B não enfileira na instância da igreja A", x.status === 403 || x.body?.code === "42501", `HTTP ${x.status}`);

// Enfileirar e esperar o cron enviar (FakeProvider)
const e = await rest(A, "disparador")("POST", "rpc/enqueue_message", enqArgs("Contato Fictício A1", "+5511900001001"));
check("admin A enfileira abertura com variações", e.status === 200 && typeof e.body === "string", `HTTP ${e.status}`);
const msgId = e.body;
let status = "", prov = null;
for (let i = 0; i < 20 && status !== "sent"; i++) {
  await new Promise((r) => setTimeout(r, 10000));
  const s = await rest(A, "disparador")("GET", `outbound_messages?select=status,provider_message_id,body&id=eq.${msgId}`);
  status = s.body?.[0]?.status; prov = s.body?.[0]?.provider_message_id;
  if (i === 0) check("corpo renderizado com o nome", (s.body?.[0]?.body ?? "").includes("Contato Fictício A1"));
}
check("cron enviou a mensagem (sent + id do provedor)", status === "sent" && !!prov, `status=${status}`);
const u = await rest(A, "disparador")("GET", "daily_usage?select=sent&instance_id=eq.a1000000-0000-0000-0000-00000000000a");
check("uso diário contabilizado uma vez", u.body?.[0]?.sent === 1, `sent=${u.body?.[0]?.sent}`);

// Webhook: rotacionar chave, receber, deduplicar, opt-out
const k = await rest(A, "disparador")("POST", "rpc/rotate_webhook_key", { p_instance_id: "a1000000-0000-0000-0000-00000000000a" });
const key = typeof k.body === "string" ? k.body : k.body?.key ?? k.body?.[0]?.key;
check("admin A rotaciona a chave do webhook", k.status === 200 && !!key, `HTTP ${k.status}`);
const hook = (id, text, keyOverride) => fetch(`${U}/functions/v1/disparador-webhook?instance=hom-ficticia-a`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-disparador-key": keyOverride ?? key },
  body: JSON.stringify({ event: "messages.upsert", instance: "hom-ficticia-a", data: {
    key: { remoteJid: "5511900001002@s.whatsapp.net", fromMe: false, id },
    message: { conversation: text }, messageTimestamp: Math.floor(Date.now() / 1000) } }),
});
const w0 = await hook("HOM-E2E-BAD", "Oi", "dk_chave_errada");
check("webhook recusa chave inválida", w0.status === 401, `HTTP ${w0.status}`);
const w1 = await hook("HOM-E2E-1", "Oi, tudo bem");
const w2 = await hook("HOM-E2E-1", "Oi, tudo bem");
check("webhook aceita mensagem", w1.ok, `HTTP ${w1.status}`);
check("webhook aceita reenvio duplicado sem erro", w2.ok, `HTTP ${w2.status}`);
const inbound = await rest(A, "disparador")("GET", "inbound_messages?select=id&provider_message_id=eq.HOM-E2E-1");
check("resposta gravada uma única vez", inbound.body?.length === 1, `n=${inbound.body?.length}`);
const w3 = await hook("HOM-E2E-2", "SAIR");
const c = await rest(A, "disparador")("GET", "contacts?select=opted_out_at&phone_e164=eq.%2B5511900001002");
check("SAIR registra opt-out", w3.ok && !!c.body?.[0]?.opted_out_at);
const inbB = await rest(B, "disparador")("GET", "inbound_messages?select=id");
check("admin B não vê respostas da igreja A", inbB.status === 200 && inbB.body.length === 0);

// Ligar por QR (Edge Function com JWT do usuário)
const q = await fetch(`${U}/functions/v1/disparador-instance-connect`, {
  method: "POST", headers: { apikey: PK, Authorization: `Bearer ${A}`, "Content-Type": "application/json" },
  body: JSON.stringify({ instance_id: "a1000000-0000-0000-0000-00000000000a", instanceId: "a1000000-0000-0000-0000-00000000000a" }),
});
check("admin A chama instance-connect", q.ok, `HTTP ${q.status} ${(await q.text()).slice(0, 80)}`);
const q2 = await fetch(`${U}/functions/v1/disparador-instance-connect`, {
  method: "POST", headers: { apikey: PK, Authorization: `Bearer ${B}`, "Content-Type": "application/json" },
  body: JSON.stringify({ instance_id: "a1000000-0000-0000-0000-00000000000a", instanceId: "a1000000-0000-0000-0000-00000000000a" }),
});
check("admin B não liga instância da igreja A", q2.status === 403 || q2.status === 404, `HTTP ${q2.status}`);

console.log(fails === 0 ? "RESULTADO: TODOS PASSARAM" : `RESULTADO: ${fails} FALHA(S)`);
