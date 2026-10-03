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

Deno.test("evolution: connect devolve o QR (base64) ou nada se já conectada", async () => {
  const qr = await provider(recorder(200, connectQr).fetchStub).connect("inst-teste");
  assertEquals(qr.qrCode, connectQr.base64);

  const { calls, fetchStub } = recorder(200, connectOpen);
  assertEquals(await provider(fetchStub).connect("inst-teste"), {});
  assertEquals(calls[0].url, "https://evolution.teste.invalid/instance/connect/inst-teste");
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
