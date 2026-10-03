import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  type ConnectAuthorizer,
  createConnectHandler,
  createUserAuthorizer,
} from "./connect_handler.ts";
import { FakeProvider } from "./fake.ts";
import type { MessagingProvider } from "./provider.ts";
import type { InstanceStatus } from "./tick.ts";

const INSTANCE_ID = "45000000-0000-0000-0000-00000000000a";
const TOKEN = "jwt-do-usuario-ficticio";

class StatusRepo {
  updates: { id: string; status: InstanceStatus }[] = [];
  setInstanceStatus(id: string, status: InstanceStatus): Promise<void> {
    this.updates.push({ id, status });
    return Promise.resolve();
  }
}

const allow: ConnectAuthorizer = () => Promise.resolve({ ok: true, instanceName: "inst-a" });

const post = (
  body: unknown,
  headers: Record<string, string> = { Authorization: `Bearer ${TOKEN}` },
) =>
  new Request("http://localhost/disparador-instance-connect", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

Deno.test("connect: sem Authorization → 401 e nada é chamado", async () => {
  let authorized = 0;
  const handler = createConnectHandler({
    authorize: () => {
      authorized++;
      return allow(TOKEN, INSTANCE_ID);
    },
    repo: new StatusRepo(),
    provider: () => new FakeProvider("close"),
  });
  const res = await handler(post({ instance_id: INSTANCE_ID }, {}));
  assertEquals(res.status, 401);
  assertEquals(authorized, 0);
  await res.body?.cancel();
});

Deno.test("connect: só POST", async () => {
  const handler = createConnectHandler({
    authorize: allow,
    repo: new StatusRepo(),
    provider: () => new FakeProvider(),
  });
  const res = await handler(new Request("http://localhost/x", { method: "GET" }));
  assertEquals(res.status, 405);
  await res.body?.cancel();
});

Deno.test("connect: instance_id inválido → 400", async () => {
  const handler = createConnectHandler({
    authorize: allow,
    repo: new StatusRepo(),
    provider: () => new FakeProvider(),
  });
  const res = await handler(post({ instance_id: "1 or 1=1" }));
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("connect: não-admin ou outra igreja → 403 e o provedor não é chamado", async () => {
  const provider = new FakeProvider("close");
  const repo = new StatusRepo();
  let receivedToken = "";
  const handler = createConnectHandler({
    authorize: (token) => {
      receivedToken = token;
      return Promise.resolve({ ok: false, status: 403 });
    },
    repo,
    provider: () => provider,
  });
  const res = await handler(post({ instance_id: INSTANCE_ID }));
  assertEquals(res.status, 403);
  assertEquals(receivedToken, TOKEN, "a autorização usa o JWT do próprio usuário");
  assertEquals(provider.healthChecks.length, 0);
  assertEquals(repo.updates.length, 0);
  await res.body?.cancel();
});

Deno.test("connect: JWT inválido/expirado → 401", async () => {
  const handler = createConnectHandler({
    authorize: () => Promise.resolve({ ok: false, status: 401 }),
    repo: new StatusRepo(),
    provider: () => new FakeProvider("close"),
  });
  const res = await handler(post({ instance_id: INSTANCE_ID }));
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("connect: instância desligada → QR devolvido e estado 'connecting'", async () => {
  const repo = new StatusRepo();
  const handler = createConnectHandler({
    authorize: allow,
    repo,
    provider: () => new FakeProvider("close"),
  });
  const res = await handler(post({ instance_id: INSTANCE_ID }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { status: "connecting", qr_code: "fake-qr:inst-a" });
  assertEquals(repo.updates, [{ id: INSTANCE_ID, status: "connecting" }]);
});

Deno.test("connect: instância já conectada → 'open' sem QR", async () => {
  const repo = new StatusRepo();
  const handler = createConnectHandler({
    authorize: allow,
    repo,
    provider: () => new FakeProvider("open"),
  });
  const res = await handler(post({ instance_id: INSTANCE_ID }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { status: "open" });
  assertEquals(repo.updates, [{ id: INSTANCE_ID, status: "open" }]);
});

Deno.test("connect: provedor que não responde → 502 por timeout, estado intacto", async () => {
  const repo = new StatusRepo();
  const hanging: MessagingProvider = {
    name: "hang",
    connectionState: () => new Promise(() => {}),
    sendText: () => new Promise(() => {}),
    connect: () => new Promise(() => {}),
  };
  const handler = createConnectHandler({
    authorize: allow,
    repo,
    provider: () => hanging,
    timeoutMs: 20,
  });
  const res = await handler(post({ instance_id: INSTANCE_ID }));
  assertEquals(res.status, 502);
  assertEquals(await res.json(), { error: "provider_unavailable" });
  assertEquals(repo.updates.length, 0);
});

Deno.test("connect: erro do provedor nunca vaza segredos na resposta", async () => {
  const leaky: MessagingProvider = {
    name: "leaky",
    connectionState: () => Promise.reject(new Error("apikey=SEGREDO-FICTICIO")),
    sendText: () => Promise.reject(new Error("apikey=SEGREDO-FICTICIO")),
    connect: () => Promise.reject(new Error("apikey=SEGREDO-FICTICIO http://evolution.interna")),
  };
  const handler = createConnectHandler({
    authorize: allow,
    repo: new StatusRepo(),
    provider: () => leaky,
  });
  const res = await handler(post({ instance_id: INSTANCE_ID }));
  const text = await res.text();
  assertEquals(res.status, 502);
  assertFalse(text.includes("SEGREDO"));
  assertFalse(text.includes("evolution.interna"));
});

type Call = { url: string; init: RequestInit };

Deno.test("authorizer: chama connect_target com o JWT do usuário e a chave pública", async () => {
  const calls: Call[] = [];
  const authorize = createUserAuthorizer({
    url: "http://supabase.teste.invalid",
    anonKey: "chave-publica-ficticia",
    fetch: (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return Promise.resolve(new Response(JSON.stringify("inst-a"), { status: 200 }));
    },
  });
  const decision = await authorize(TOKEN, INSTANCE_ID);
  assertEquals(decision, { ok: true, instanceName: "inst-a" });
  assertEquals(calls[0].url, "http://supabase.teste.invalid/rest/v1/rpc/connect_target");
  const headers = new Headers(calls[0].init.headers);
  assertEquals(headers.get("Authorization"), `Bearer ${TOKEN}`);
  assertEquals(headers.get("apikey"), "chave-publica-ficticia");
  assertEquals(headers.get("Content-Profile"), "disparador");
  assertEquals(JSON.parse(String(calls[0].init.body)), { p_instance_id: INSTANCE_ID });
});

Deno.test("authorizer: 42501 → 403; JWT rejeitado pelo PostgREST → 401", async () => {
  const forbid = createUserAuthorizer({
    url: "http://supabase.teste.invalid",
    anonKey: "k",
    fetch: () => Promise.resolve(new Response(JSON.stringify({ code: "42501" }), { status: 403 })),
  });
  assertEquals(await forbid(TOKEN, INSTANCE_ID), { ok: false, status: 403 });

  const badJwt = createUserAuthorizer({
    url: "http://supabase.teste.invalid",
    anonKey: "k",
    fetch: () =>
      Promise.resolve(new Response(JSON.stringify({ code: "PGRST301" }), { status: 401 })),
  });
  assertEquals(await badJwt(TOKEN, INSTANCE_ID), { ok: false, status: 401 });
});

Deno.test("rpc: bearer separado da apikey não muda o padrão service role", async () => {
  const { createRpcClient } = await import("./rpc.ts");
  const calls: Call[] = [];
  const rpc = createRpcClient({
    url: "http://supabase.teste.invalid",
    serviceKey: "service-ficticia",
    fetch: (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return Promise.resolve(new Response("null", { status: 200 }));
    },
  });
  await rpc("touch_heartbeat");
  const headers = new Headers(calls[0].init.headers);
  assert(headers.get("Authorization") === "Bearer service-ficticia");
});
