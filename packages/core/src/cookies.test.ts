import assert from "node:assert/strict";
import { test } from "node:test";
import { cookieDomainFrom, withSharedDomain } from "./cookies.ts";

test("sem AUTH_COOKIE_DOMAIN → sem domínio (comportamento atual, cookie do próprio host)", () => {
  assert.equal(cookieDomainFrom(undefined), undefined);
  assert.equal(cookieDomainFrom(""), undefined);
  assert.equal(cookieDomainFrom("   "), undefined);
});

test("domínio compartilhado é normalizado (minúsculas, sem espaços)", () => {
  assert.equal(cookieDomainFrom(".hagap.online"), ".hagap.online");
  assert.equal(cookieDomainFrom("  HAGAP.online "), "hagap.online");
});

test("valor inválido é ignorado (falha segura: cookie fica no próprio host)", () => {
  assert.equal(cookieDomainFrom("https://hagap.online"), undefined);
  assert.equal(cookieDomainFrom("hagap.online/painel"), undefined);
  assert.equal(cookieDomainFrom("localhost"), undefined);
  assert.equal(cookieDomainFrom("hagap online"), undefined);
});

test("withSharedDomain acrescenta o domínio só quando configurado", () => {
  assert.deepEqual(withSharedDomain({ path: "/", httpOnly: true }, undefined), { path: "/", httpOnly: true });
  assert.deepEqual(withSharedDomain({ path: "/" }, ".hagap.online"), { path: "/", domain: ".hagap.online" });
});
