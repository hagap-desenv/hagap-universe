import { assertEquals } from "@std/assert";
import { FakeProvider } from "./fake.ts";
import type { ClaimedMessage, DispatchableInstance, InstanceStatus, TickRepo } from "./tick.ts";
import { runTick } from "./tick.ts";

// Repositório em memória que regista a ordem das chamadas (dados fictícios)
class MemoryRepo implements TickRepo {
  events: string[] = [];
  statuses = new Map<string, InstanceStatus>();
  sent = new Map<string, string>();
  failed = new Map<string, string>();
  reaped = 0;
  failReap = false;

  constructor(
    public instances: DispatchableInstance[],
    public queues: Record<string, ClaimedMessage[]>,
  ) {}

  reapStuckSending(): Promise<number> {
    this.events.push("reap");
    if (this.failReap) return Promise.reject(new Error("db indisponível"));
    return Promise.resolve(this.reaped);
  }
  listDispatchableInstances(): Promise<DispatchableInstance[]> {
    this.events.push("list");
    return Promise.resolve(this.instances);
  }
  setInstanceStatus(instanceId: string, status: InstanceStatus): Promise<void> {
    this.events.push(`status:${instanceId}:${status}`);
    this.statuses.set(instanceId, status);
    return Promise.resolve();
  }
  claimNext(instanceId: string): Promise<ClaimedMessage | null> {
    this.events.push(`claim:${instanceId}`);
    return Promise.resolve(this.queues[instanceId]?.shift() ?? null);
  }
  markSent(messageId: string, providerMessageId: string): Promise<void> {
    this.events.push(`sent:${messageId}`);
    this.sent.set(messageId, providerMessageId);
    return Promise.resolve();
  }
  markFailed(messageId: string, error: string): Promise<void> {
    this.events.push(`failed:${messageId}`);
    this.failed.set(messageId, error);
    return Promise.resolve();
  }
}

const instA = { id: "inst-a-id", name: "inst-a" };
const instB = { id: "inst-b-id", name: "inst-b" };
const msg = (id: string, n: string): ClaimedMessage => ({
  id,
  recipient_e164: `+551190000000${n}`,
  body: `Olá Pessoa ${n}`,
});

Deno.test("tick: health-check antes do claim e envio com sucesso → mark_sent", async () => {
  const repo = new MemoryRepo([instA], { [instA.id]: [msg("m1", "1")] });
  const provider = new FakeProvider("open");

  const summary = await runTick(repo, provider);

  assertEquals(provider.healthChecks, ["inst-a"]);
  assertEquals(repo.events, ["reap", "list", "claim:inst-a-id", "sent:m1"]);
  assertEquals(provider.sent.length, 1);
  assertEquals(provider.sent[0].toE164, "+5511900000001");
  assertEquals(repo.sent.get("m1"), provider.sent[0].providerMessageId);
  assertEquals(summary.sent, 1);
});

Deno.test("tick: instância fechada → marca disconnected e não reclama", async () => {
  const repo = new MemoryRepo([instA], { [instA.id]: [msg("m1", "1")] });
  const provider = new FakeProvider("open");
  provider.setState("inst-a", "close");

  const summary = await runTick(repo, provider);

  assertEquals(repo.events, ["reap", "list", "status:inst-a-id:disconnected"]);
  assertEquals(provider.sent.length, 0);
  assertEquals(summary.disconnected, 1);
});

Deno.test("tick: instância a conectar é transitória → não marca disconnected nem reclama", async () => {
  const repo = new MemoryRepo([instA], { [instA.id]: [msg("m1", "1")] });
  const provider = new FakeProvider("connecting");

  const summary = await runTick(repo, provider);

  assertEquals(repo.statuses.has("inst-a-id"), false);
  assertEquals(repo.events, ["reap", "list"]);
  assertEquals(summary.connecting, 1);
  assertEquals(summary.disconnected, 0);
});

Deno.test("tick: erro no health-check → não reclama nem muda estado", async () => {
  const repo = new MemoryRepo([instA], { [instA.id]: [msg("m1", "1")] });
  const provider = new FakeProvider("open");
  provider.failState("inst-a");

  const summary = await runTick(repo, provider);

  assertEquals(repo.events, ["reap", "list"]);
  assertEquals(summary.errors, 1);
});

Deno.test("tick: health-check sem resposta → timeout, sem claim", async () => {
  const repo = new MemoryRepo([instA], { [instA.id]: [msg("m1", "1")] });
  const provider = new FakeProvider("open");
  provider.hangState("inst-a");

  const summary = await runTick(repo, provider, { timeoutMs: 20 });

  assertEquals(repo.events, ["reap", "list"]);
  assertEquals(summary.errors, 1);
});

Deno.test("tick: falha no envio → mark_failed, sem retry", async () => {
  const repo = new MemoryRepo([instA], { [instA.id]: [msg("m1", "1"), msg("m2", "2")] });
  const provider = new FakeProvider("open");
  provider.failSend("inst-a");

  const summary = await runTick(repo, provider);

  assertEquals(repo.events, ["reap", "list", "claim:inst-a-id", "failed:m1"]);
  assertEquals(repo.failed.has("m1"), true);
  assertEquals(summary.failed, 1);
  assertEquals(summary.sent, 0);
});

Deno.test("tick: envio sem resposta → timeout → mark_failed, sem retry", async () => {
  const repo = new MemoryRepo([instA], { [instA.id]: [msg("m1", "1")] });
  const provider = new FakeProvider("open");
  provider.hangSend("inst-a");

  const summary = await runTick(repo, provider, { timeoutMs: 20 });

  assertEquals(repo.events, ["reap", "list", "claim:inst-a-id", "failed:m1"]);
  assertEquals(repo.failed.get("m1"), "timeout");
  assertEquals(summary.failed, 1);
});

Deno.test("tick: claim vazio (janela/cap/intervalo) → nada enviado", async () => {
  const repo = new MemoryRepo([instA], {});
  const provider = new FakeProvider("open");

  const summary = await runTick(repo, provider);

  assertEquals(repo.events, ["reap", "list", "claim:inst-a-id"]);
  assertEquals(provider.sent.length, 0);
  assertEquals(summary.idle, 1);
});

Deno.test("tick: nunca 2 mensagens da mesma instância no mesmo tick", async () => {
  const repo = new MemoryRepo([instA, instA], {
    [instA.id]: [msg("m1", "1"), msg("m2", "2"), msg("m3", "3")],
  });
  const provider = new FakeProvider("open");

  const summary = await runTick(repo, provider);

  assertEquals(provider.sent.length, 1);
  assertEquals(repo.events.filter((e) => e.startsWith("claim:")).length, 1);
  assertEquals(summary.instances, 1);
});

Deno.test("tick: instâncias diferentes são tratadas de forma independente", async () => {
  const repo = new MemoryRepo([instA, instB], {
    [instA.id]: [msg("m1", "1")],
    [instB.id]: [msg("m2", "2")],
  });
  const provider = new FakeProvider("open");
  provider.setState("inst-b", "close");

  const summary = await runTick(repo, provider);

  assertEquals(provider.sent.map((s) => s.instance), ["inst-a"]);
  assertEquals(repo.statuses.get("inst-b-id"), "disconnected");
  assertEquals(summary, {
    instances: 2,
    sent: 1,
    failed: 0,
    disconnected: 1,
    connecting: 0,
    idle: 0,
    errors: 0,
    reaped: 0,
  });
});

Deno.test("tick: varre mensagens presas em sending a cada execução, antes de enviar", async () => {
  const repo = new MemoryRepo([], {});
  repo.reaped = 2;

  const summary = await runTick(repo, new FakeProvider("open"));

  assertEquals(repo.events, ["reap", "list"]);
  assertEquals(summary.reaped, 2);
});

Deno.test("tick: falha na varredura não impede o envio", async () => {
  const repo = new MemoryRepo([instA], { [instA.id]: [msg("m1", "1")] });
  repo.failReap = true;

  const summary = await runTick(repo, new FakeProvider("open"));

  assertEquals(summary.sent, 1);
  assertEquals(summary.errors, 1);
});
