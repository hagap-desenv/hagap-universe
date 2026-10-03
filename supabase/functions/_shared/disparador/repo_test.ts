import { assertEquals, assertRejects } from "@std/assert";
import { createDisparadorRepo } from "./repo.ts";
import { createRpcClient, RpcError } from "./rpc.ts";

type Call = { url: string; init: RequestInit };

function stubFetch(responses: Record<string, () => Response>, calls: Call[]): typeof fetch {
  return (input, init) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    const fn = url.split("/rpc/")[1];
    return Promise.resolve(responses[fn]?.() ?? new Response("", { status: 404 }));
  };
}

const rpcFor = (responses: Record<string, () => Response>, calls: Call[]) =>
  createRpcClient({
    url: "http://supabase.teste.invalid/",
    serviceKey: "chave-ficticia",
    fetch: stubFetch(responses, calls),
  });

Deno.test("rpc: chama /rest/v1/rpc com schema disparador e service key", async () => {
  const calls: Call[] = [];
  const repo = createDisparadorRepo(
    rpcFor({ mark_sent: () => new Response(null, { status: 204 }) }, calls),
  );

  await repo.markSent("m1", "prov-1");

  assertEquals(calls[0].url, "http://supabase.teste.invalid/rest/v1/rpc/mark_sent");
  const headers = calls[0].init.headers as Record<string, string>;
  assertEquals(headers["Content-Profile"], "disparador");
  assertEquals(headers["apikey"], "chave-ficticia");
  assertEquals(headers["Authorization"], "Bearer chave-ficticia");
  assertEquals(JSON.parse(String(calls[0].init.body)), {
    p_message_id: "m1",
    p_provider_message_id: "prov-1",
  });
});

Deno.test("repo: claim_next nulo (null ou campos nulos) → nada a enviar", async () => {
  const calls: Call[] = [];
  const nullBody = createDisparadorRepo(
    rpcFor({ claim_next: () => new Response("null", { status: 200 }) }, calls),
  );
  const nullFields = createDisparadorRepo(
    rpcFor({ claim_next: () => Response.json({ id: null, body: null }) }, calls),
  );
  assertEquals(await nullBody.claimNext("i1"), null);
  assertEquals(await nullFields.claimNext("i1"), null);
});

Deno.test("repo: claim_next com mensagem e lista de instâncias", async () => {
  const calls: Call[] = [];
  const repo = createDisparadorRepo(rpcFor({
    claim_next: () => Response.json({ id: "m1", recipient_e164: "+5511900000001", body: "Olá Um" }),
    list_dispatchable_instances: () =>
      Response.json([{ instance_id: "i1", instance_name: "inst-a" }]),
  }, calls));

  assertEquals(await repo.claimNext("i1"), {
    id: "m1",
    recipient_e164: "+5511900000001",
    body: "Olá Um",
  });
  assertEquals(await repo.listDispatchableInstances(), [{ id: "i1", name: "inst-a" }]);
});

Deno.test("rpc: erro expõe só HTTP e código, nunca o texto do banco", async () => {
  const calls: Call[] = [];
  const rpc = rpcFor({
    mark_failed: () =>
      Response.json({ code: "42501", message: "dados +5511900000001" }, { status: 403 }),
  }, calls);

  const error = await assertRejects(() => rpc("mark_failed", {}), RpcError);
  assertEquals(error.message.includes("+5511"), false);
  assertEquals(error.code, "42501");
});
