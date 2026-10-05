import assert from "node:assert/strict";
import { test } from "node:test";
import { type AppEntry, visibleApps } from "./app-catalog.ts";

const catalog: AppEntry[] = [
  { key: "disparador", name: "Disparador", description: "d", module: "disparador", roles: ["admin", "coordenador", "mentor"], url: "https://d.example" },
  { key: "pai", name: "PAI", description: "p", module: "pai", roles: ["admin", "coordenador", "mentor"], url: "https://p.example" },
  { key: "gestao", name: "Gestão", description: "g", module: "gestao", roles: ["admin"], url: undefined },
];

const keys = (apps: AppEntry[]) => apps.map((a) => a.key);

test("só aparecem apps com módulo habilitado na igreja ativa", () => {
  assert.deepEqual(keys(visibleApps(catalog, { role: "admin", modules: ["disparador", "cuidado"] })), ["disparador"]);
});

test("papel fora da lista do app não vê o card", () => {
  assert.deepEqual(keys(visibleApps(catalog, { role: "mentor", modules: ["disparador", "pai", "gestao"] })), [
    "disparador",
    "pai",
  ]);
  assert.deepEqual(keys(visibleApps(catalog, { role: "admin", modules: ["disparador", "pai", "gestao"] })), [
    "disparador",
    "pai",
    "gestao",
  ]);
});

test("super_admin vê todos os apps, independentemente dos módulos", () => {
  assert.deepEqual(keys(visibleApps(catalog, { role: "super_admin", modules: [] })), ["disparador", "pai", "gestao"]);
});

test("sem igreja ativa ou sem módulos → nenhum app (estado vazio)", () => {
  assert.deepEqual(visibleApps(catalog, { role: null, modules: [] }), []);
  assert.deepEqual(visibleApps(catalog, { role: "admin", modules: [] }), []);
});
