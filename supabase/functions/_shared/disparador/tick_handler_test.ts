import { assertEquals } from "@std/assert";
import { FakeProvider } from "./fake.ts";
import type { ClaimedMessage, DispatchableInstance, InstanceStatus } from "./tick.ts";
import { createTickHandler, TICK_JOB } from "./tick_handler.ts";

const SECRET = "segredo-de-teste-cron";

class Repo {
  heartbeats: { job: string; status: string; detail: Record<string, unknown> }[] = [];
  listed = 0;
  constructor(private queue: ClaimedMessage[] = [], private failList = false) {}
  reapStuckSending(): Promise<number> {
    return Promise.resolve(0);
  }
  listDispatchableInstances(): Promise<DispatchableInstance[]> {
    this.listed++;
    if (this.failList) return Promise.reject(new Error("db indisponível"));
    return Promise.resolve([{ id: "inst-a-id", name: "inst-a" }]);
  }
  setInstanceStatus(_id: string, _status: InstanceStatus): Promise<void> {
    return Promise.resolve();
  }
  claimNext(_id: string): Promise<ClaimedMessage | null> {
    return Promise.resolve(this.queue.shift() ?? null);
  }
  markSent(): Promise<void> {
    return Promise.resolve();
  }
  markFailed(): Promise<void> {
    return Promise.resolve();
  }
  touchHeartbeat(job: string, status: string, detail: Record<string, unknown>): Promise<void> {
    this.heartbeats.push({ job, status, detail });
    return Promise.resolve();
  }
}

const post = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/disparador-tick", { method: "POST", headers });

Deno.test("tick handler: sem x-cron-secret → 401 e nada é executado", async () => {
  const repo = new Repo();
  const handler = createTickHandler({
    cronSecret: SECRET,
    repo,
    provider: () => new FakeProvider(),
  });

  const res = await handler(post());

  assertEquals(res.status, 401);
  assertEquals(repo.listed, 0);
  await res.body?.cancel();
});

Deno.test("tick handler: segredo errado → 401", async () => {
  const repo = new Repo();
  const handler = createTickHandler({
    cronSecret: SECRET,
    repo,
    provider: () => new FakeProvider(),
  });

  const res = await handler(post({ "x-cron-secret": "outro-segredo" }));

  assertEquals(res.status, 401);
  assertEquals(repo.listed, 0);
  await res.body?.cancel();
});

Deno.test("tick handler: DISPARADOR_CRON_SECRET ausente → falha fechada (500)", async () => {
  const repo = new Repo();
  const handler = createTickHandler({ cronSecret: "", repo, provider: () => new FakeProvider() });

  const res = await handler(post({ "x-cron-secret": "" }));

  assertEquals(res.status, 500);
  assertEquals(repo.listed, 0);
  await res.body?.cancel();
});

Deno.test("tick handler: método diferente de POST → 405", async () => {
  const repo = new Repo();
  const handler = createTickHandler({
    cronSecret: SECRET,
    repo,
    provider: () => new FakeProvider(),
  });

  const res = await handler(
    new Request("http://localhost/disparador-tick", { headers: { "x-cron-secret": SECRET } }),
  );

  assertEquals(res.status, 405);
  await res.body?.cancel();
});

Deno.test("tick handler: segredo certo → executa o tick e grava heartbeat ok", async () => {
  const repo = new Repo([{ id: "m1", recipient_e164: "+5511900000001", body: "Olá Um" }]);
  const provider = new FakeProvider();
  const handler = createTickHandler({ cronSecret: SECRET, repo, provider: () => provider });

  const res = await handler(post({ "x-cron-secret": SECRET }));
  const json = await res.json();

  assertEquals(res.status, 200);
  assertEquals(json.sent, 1);
  assertEquals(provider.sent.length, 1);
  assertEquals(repo.heartbeats.length, 1);
  assertEquals(repo.heartbeats[0].job, TICK_JOB);
  assertEquals(repo.heartbeats[0].status, "ok");
  assertEquals(repo.heartbeats[0].detail.provider, "fake");
});

Deno.test("tick handler: erro no tick → 500 e heartbeat com status error", async () => {
  const repo = new Repo([], true);
  const handler = createTickHandler({
    cronSecret: SECRET,
    repo,
    provider: () => new FakeProvider(),
  });

  const res = await handler(post({ "x-cron-secret": SECRET }));

  assertEquals(res.status, 500);
  assertEquals(repo.heartbeats.length, 1);
  assertEquals(repo.heartbeats[0].status, "error");
  await res.body?.cancel();
});

Deno.test("tick handler: provider inválido → heartbeat error, sem envio", async () => {
  const repo = new Repo();
  const handler = createTickHandler({
    cronSecret: SECRET,
    repo,
    provider: () => {
      throw new Error("DISPARADOR_PROVIDER inválido: x");
    },
  });

  const res = await handler(post({ "x-cron-secret": SECRET }));

  assertEquals(res.status, 500);
  assertEquals(repo.listed, 0);
  assertEquals(repo.heartbeats[0].status, "error");
  await res.body?.cancel();
});
