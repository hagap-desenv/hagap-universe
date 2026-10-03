import assert from "node:assert/strict";
import { test } from "node:test";
import { definePermissions } from "./permissions.ts";

const perms = definePermissions(["ver", "gerir", "admin"], {
  admin: ["ver", "gerir", "admin"],
  coordenador: ["ver", "gerir"],
  mentor: ["ver"],
});

test("mentor só tem as permissões da matriz", () => {
  assert.equal(perms.can("mentor", "ver"), true);
  assert.equal(perms.can("mentor", "admin"), false);
  assert.deepEqual(perms.permissionsFor("mentor"), ["ver"]);
});

test("admin da igreja tem a área admin; coordenador não", () => {
  assert.equal(perms.can("admin", "admin"), true);
  assert.equal(perms.can("coordenador", "admin"), false);
});

test("super_admin tem todas as permissões", () => {
  assert.deepEqual(perms.permissionsFor("super_admin"), ["ver", "gerir", "admin"]);
});

test("sem role → nenhuma permissão (falha fechada)", () => {
  assert.equal(perms.can(null, "ver"), false);
  assert.equal(perms.can(undefined, "ver"), false);
  assert.deepEqual(perms.permissionsFor(null), []);
});

test("permissão fora da lista é erro de configuração", () => {
  assert.throws(() =>
    definePermissions(["ver"], {
      admin: ["ver", "outra" as "ver"],
      coordenador: [],
      mentor: [],
    })
  );
});
