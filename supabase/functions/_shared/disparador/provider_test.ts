import { assertEquals, assertThrows } from "@std/assert";
import { FakeProvider } from "./fake.ts";
import { getProvider, type MessagingProvider } from "./provider.ts";

const factories = {
  fake: (): MessagingProvider => new FakeProvider(),
  evolution: (): MessagingProvider => Object.assign(new FakeProvider(), { name: "evolution" }),
};
const envOf = (vars: Record<string, string>) => (key: string) => vars[key];

Deno.test("getProvider: default é fake", () => {
  assertEquals(getProvider(envOf({}), factories).name, "fake");
});

Deno.test("getProvider: escolhe evolution por env", () => {
  assertEquals(
    getProvider(envOf({ DISPARADOR_PROVIDER: "evolution" }), factories).name,
    "evolution",
  );
});

Deno.test("getProvider: valor desconhecido é erro (não cai no fake)", () => {
  assertThrows(() => getProvider(envOf({ DISPARADOR_PROVIDER: "outro" }), factories));
});

Deno.test("FakeProvider: estados controláveis e QR ao conectar", async () => {
  const fake = new FakeProvider("close");
  assertEquals(await fake.connectionState("x"), "close");
  assertEquals((await fake.connect("x")).qrCode, "fake-qr:x");
  assertEquals(await fake.connectionState("x"), "connecting");
  fake.setState("x", "open");
  assertEquals(await fake.connect("x"), {});
  const sent = await fake.sendText("x", "+5511900000001", "Olá Um");
  assertEquals(fake.sent[0].providerMessageId, sent.providerMessageId);
});
