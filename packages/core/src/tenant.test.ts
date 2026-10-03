import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatCnpj,
  isMemberOf,
  resolveActiveTenant,
  safeRedirectPath,
  type TenantMembership,
} from "./tenant.ts";

const a: TenantMembership = {
  tenantId: "aaaaaaaa-0000-0000-0000-000000000001",
  name: "Igreja A",
  cnpj: "00000000000000",
  slug: "igreja-a",
  timezone: "America/Sao_Paulo",
  role: "admin",
  modules: ["cuidado"],
};
const b: TenantMembership = { ...a, tenantId: "bbbbbbbb-0000-0000-0000-000000000002", name: "Igreja B", role: "mentor" };

test("cookie de igreja da qual o usuário é membro é aceito", () => {
  assert.equal(resolveActiveTenant([a, b], b.tenantId), b);
});

test("cookie forjado (igreja sem membership) é ignorado → primeira igreja", () => {
  assert.equal(resolveActiveTenant([a], b.tenantId), a);
  assert.equal(resolveActiveTenant([a], "' or 1=1 --"), a);
});

test("sem cookie → primeira igreja; sem memberships → nenhuma", () => {
  assert.equal(resolveActiveTenant([a, b], undefined), a);
  assert.equal(resolveActiveTenant([], a.tenantId), null);
});

test("isMemberOf valida o tenant pedido", () => {
  assert.equal(isMemberOf([a], a.tenantId), true);
  assert.equal(isMemberOf([a], b.tenantId), false);
  assert.equal(isMemberOf([a], ""), false);
});

test("safeRedirectPath só aceita caminhos internos", () => {
  assert.equal(safeRedirectPath("/admin"), "/admin");
  assert.equal(safeRedirectPath("//evil.example"), "/");
  assert.equal(safeRedirectPath("/\\evil.example"), "/");
  assert.equal(safeRedirectPath("https://evil.example"), "/");
  assert.equal(safeRedirectPath("/ok\nSet-Cookie: x"), "/");
  assert.equal(safeRedirectPath(null, "/inicio"), "/inicio");
});

test("formatCnpj aplica a máscara só para exibição", () => {
  assert.equal(formatCnpj("11222333000181"), "11.222.333/0001-81");
});
