// Teste de contrato do EvolutionProvider contra respostas gravadas da Evolution v2.
// fetch stubado: nenhuma chamada real. Dados fictícios.
import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { evolutionFromEnv, EvolutionProvider } from "./evolution.ts";
import { TimeoutError } from "./timeout.ts";
import stateOpen from "./fixtures/evolution/connection_state_open.json" with { type: "json" };
import stateClose from "./fixtures/evolution/connection_state_close.json" with { type: "json" };
import stateConnecting from "./fixtures/evolution/connection_state_connecting.json" with {
  type: "json",
};
import sendTextOk from "./fixtures/evolution/send_text.json" with { type: "json" };
import connectQr from "./fixtures/evolution/connect_qr.json" with { type: "json" };
import connectOpen from "./fixtures/evolution/connect_open.json" with { type: "json" };
import notFound from "./fixtures/evolution/error_not_found.json" with { type: "json" };
import unauthorized from "./fixtures/evolution/error_unauthorized.json" with { type: "json" };
import stateNotFound from "./fixtures/evolution/connection_state_not_found.json" with {
  type: "json",
};
import createInstance from "./fixtures/evolution/create_instance.json" with { type: "json" };
import webhookSet from "./fixtures/evolution/webhook_set.json" with { type: "json" };
import forbidden from "./fixtures/evolution/error_forbidden.json" with { type: "json" };

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };

function recorder(status: number, payload: unknown) {
  const calls: Call[] = [];
  const fetchStub: typeof fetch = (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return Promise.resolve(Response.json(payload, { status }));
  };
  return { calls, fetchStub };
}

const provider = (fetchStub: typeof fetch, timeoutMs?: number) =>
  new EvolutionProvider({
    baseUrl: "https://evolution.teste.invalid/",
    apiKey: "chave-evolution-ficticia",
    fetch: fetchStub,
    timeoutMs,
  });

Deno.test("evolution: connectionState → GET /instance/connectionState/{instance} com apikey", async () => {
  const { calls, fetchStub } = recorder(200, stateOpen);

  assertEquals(await provider(fetchStub).connectionState("igreja a/1"), "open");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].method, "GET");
  assertEquals(
    calls[0].url,
    "https://evolution.teste.invalid/instance/connectionState/igreja%20a%2F1",
  );
  assertEquals(calls[0].headers["apikey"], "chave-evolution-ficticia");
});

Deno.test("evolution: connectionState mapeia close e connecting", async () => {
  assertEquals(await provider(recorder(200, stateClose).fetchStub).connectionState("x"), "close");
  assertEquals(
    await provider(recorder(200, stateConnecting).fetchStub).connectionState("x"),
    "connecting",
  );
});

Deno.test("evolution: sendText → POST /message/sendText/{instance} {number, text}", async () => {
  const { calls, fetchStub } = recorder(201, sendTextOk);

  const result = await provider(fetchStub).sendText("inst-teste", "+5511900000001", "Olá Teste");

  assertEquals(result, { providerMessageId: "3EB0F1C2D3E4A5B6C7D8" });
  assertEquals(calls[0].method, "POST");
  assertEquals(calls[0].url, "https://evolution.teste.invalid/message/sendText/inst-teste");
  assertEquals(calls[0].body, { number: "5511900000001", text: "Olá Teste" });
  assertEquals(calls[0].headers["Content-Type"], "application/json");
});

Deno.test("evolution: HTTP de erro → exceção com status, sem corpo e sem retry", async () => {
  const { calls, fetchStub } = recorder(404, notFound);
  const error = await assertRejects(
    () => provider(fetchStub).sendText("inst-inexistente", "+5511900000001", "Olá"),
    Error,
    "HTTP 404",
  );
  assertEquals(error.message.includes("inst-inexistente"), false);
  assertEquals(calls.length, 1);

  await assertRejects(
    () => provider(recorder(401, unauthorized).fetchStub).connectionState("x"),
    Error,
    "HTTP 401",
  );
});

Deno.test("evolution: resposta de envio sem key.id é erro", async () => {
  await assertRejects(
    () => provider(recorder(200, {}).fetchStub).sendText("x", "+5511900000001", "Olá"),
    Error,
    "key.id",
  );
});

Deno.test("evolution: sem resposta → aborta no timeout (TimeoutError), 1 chamada", async () => {
  let calls = 0;
  const hanging: typeof fetch = (_input, init) => {
    calls++;
    return new Promise((_, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
      );
    });
  };

  await assertRejects(
    () => provider(hanging, 20).sendText("x", "+5511900000001", "Olá"),
    TimeoutError,
  );
  assertEquals(calls, 1);
});

Deno.test("evolution: falha de rede não expõe detalhes", async () => {
  const broken: typeof fetch = () =>
    Promise.reject(new TypeError("dns error evolution.teste.invalid"));
  await assertRejects(() => provider(broken).connectionState("x"), Error, "falha de rede");
});

Deno.test("evolution: env obrigatório (URL e chave)", () => {
  assertThrows(() => evolutionFromEnv(() => undefined), Error, "ausentes");
  const env: Record<string, string> = {
    EVOLUTION_API_URL: "https://evolution.teste.invalid",
    EVOLUTION_API_KEY: "k",
  };
  assertEquals(evolutionFromEnv((key) => env[key]).name, "evolution");
});

// ===== Provisionamento no connect (Evolution v2.3.7) =====
const CONNECT_OPTS = {
  webhookUrl: "https://edge.teste.invalid/functions/v1/disparador-webhook?instance=inst-nova",
  webhookKey: "dk_chave_ficticia_do_teste",
};

// Roteia por "MÉTODO /caminho" e regista as chamadas na ordem
function router(routes: Record<string, [number, unknown]>) {
  const calls: Call[] = [];
  const fetchStub: typeof fetch = (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({
      url: String(input),
      method,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const route = routes[`${method} ${url.pathname}`];
    if (!route) return Promise.resolve(Response.json({ status: 404 }, { status: 404 }));
    return Promise.resolve(Response.json(route[1], { status: route[0] }));
  };
  return { calls, fetchStub };
}

const EXPECTED_WEBHOOK = {
  webhook: {
    enabled: true,
    url: CONNECT_OPTS.webhookUrl,
    headers: { "x-disparador-key": CONNECT_OPTS.webhookKey },
    byEvents: false,
    base64: false,
    events: ["MESSAGES_UPSERT"],
  },
};

Deno.test("evolution: connect de instância inexistente → create, webhook/set, connect (QR)", async () => {
  const { calls, fetchStub } = router({
    "GET /instance/connectionState/inst-nova": [404, stateNotFound],
    "POST /instance/create": [201, createInstance],
    "POST /webhook/set/inst-nova": [201, webhookSet],
    "GET /instance/connect/inst-nova": [200, connectQr],
  });

  const result = await provider(fetchStub).connect("inst-nova", CONNECT_OPTS);

  assertEquals(result, { qrCode: connectQr.base64 });
  assertEquals(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`), [
    "GET /instance/connectionState/inst-nova",
    "POST /instance/create",
    "POST /webhook/set/inst-nova",
    "GET /instance/connect/inst-nova",
  ]);
  assertEquals(calls[1].body, {
    instanceName: "inst-nova",
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
  });
  assertEquals(calls[2].body, EXPECTED_WEBHOOK);
  assertEquals(calls.every((c) => c.headers["apikey"] === "chave-evolution-ficticia"), true);
});

Deno.test("evolution: connect de instância existente → não cria; webhook/set sempre; connect", async () => {
  const { calls, fetchStub } = router({
    "GET /instance/connectionState/inst-nova": [200, stateClose],
    "POST /webhook/set/inst-nova": [201, webhookSet],
    "GET /instance/connect/inst-nova": [200, connectQr],
  });

  const result = await provider(fetchStub).connect("inst-nova", CONNECT_OPTS);

  assertEquals(result.qrCode, connectQr.base64);
  assertEquals(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`), [
    "GET /instance/connectionState/inst-nova",
    "POST /webhook/set/inst-nova",
    "GET /instance/connect/inst-nova",
  ]);
  assertEquals(calls[1].body, EXPECTED_WEBHOOK);
});

Deno.test("evolution: connect de instância já conectada → webhook reconfigurado, sem QR", async () => {
  const { calls, fetchStub } = router({
    "GET /instance/connectionState/inst-nova": [200, stateOpen],
    "POST /webhook/set/inst-nova": [201, webhookSet],
    "GET /instance/connect/inst-nova": [200, connectOpen],
  });

  assertEquals(await provider(fetchStub).connect("inst-nova", CONNECT_OPTS), {});
  assertEquals(calls.length, 3);
});

Deno.test("evolution: connect usa code quando não há base64", async () => {
  const { fetchStub } = router({
    "GET /instance/connectionState/inst-nova": [200, stateClose],
    "POST /webhook/set/inst-nova": [201, webhookSet],
    "GET /instance/connect/inst-nova": [200, { pairingCode: null, code: "2@so-code", count: 1 }],
  });
  assertEquals((await provider(fetchStub).connect("inst-nova", CONNECT_OPTS)).qrCode, "2@so-code");
});

Deno.test("evolution: falha no create → erro sem PII/chave, sem webhook nem connect", async () => {
  const { calls, fetchStub } = router({
    "GET /instance/connectionState/inst-nova": [404, stateNotFound],
    "POST /instance/create": [403, forbidden],
  });

  const error = await assertRejects(
    () => provider(fetchStub).connect("inst-nova", CONNECT_OPTS),
    Error,
    "HTTP 403",
  );
  assertEquals(error.message.includes(CONNECT_OPTS.webhookKey), false);
  assertEquals(error.message.includes("inst-nova"), false);
  assertEquals(calls.length, 2);
});

Deno.test("evolution: falha no webhook/set → erro sem a chave e sem connect", async () => {
  const { calls, fetchStub } = router({
    "GET /instance/connectionState/inst-nova": [200, stateClose],
    "POST /webhook/set/inst-nova": [400, { status: 400, error: "Bad Request" }],
  });

  const error = await assertRejects(
    () => provider(fetchStub).connect("inst-nova", CONNECT_OPTS),
    Error,
    "HTTP 400",
  );
  assertEquals(error.message.includes(CONNECT_OPTS.webhookKey), false);
  assertEquals(calls.length, 2);
});

Deno.test("evolution: connectionState com erro ≠ 404 não cria instância", async () => {
  const { calls, fetchStub } = router({
    "GET /instance/connectionState/inst-nova": [401, unauthorized],
  });
  await assertRejects(
    () => provider(fetchStub).connect("inst-nova", CONNECT_OPTS),
    Error,
    "HTTP 401",
  );
  assertEquals(calls.length, 1);
});

Deno.test("evolution: connect sem resposta → timeout por chamada, sem retry", async () => {
  let calls = 0;
  const hanging: typeof fetch = (_input, init) => {
    calls++;
    return new Promise((_, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
      );
    });
  };
  await assertRejects(() => provider(hanging, 20).connect("inst-nova", CONNECT_OPTS), TimeoutError);
  assertEquals(calls, 1);
});
