import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLocalDateTime, zonedLocalToUtc } from "./time.ts";

test("parseLocalDateTime aceita o formato do input datetime-local", () => {
  assert.deepEqual(parseLocalDateTime("2026-10-10T09:30"), { year: 2026, month: 10, day: 10, hour: 9, minute: 30 });
  assert.equal(parseLocalDateTime("10/10/2026 09:30"), null);
  assert.equal(parseLocalDateTime("2026-13-10T09:30"), null);
});

test("hora local de São Paulo (UTC-3) vira UTC", () => {
  const d = zonedLocalToUtc({ year: 2026, month: 10, day: 10, hour: 9, minute: 30 }, "America/Sao_Paulo");
  assert.equal(d.toISOString(), "2026-10-10T12:30:00.000Z");
});

test("hora local de Manaus (UTC-4) vira UTC", () => {
  const d = zonedLocalToUtc({ year: 2026, month: 1, day: 5, hour: 21, minute: 0 }, "America/Manaus");
  assert.equal(d.toISOString(), "2026-01-06T01:00:00.000Z");
});

test("fuso com horário de verão (Lisboa) respeita o deslocamento da data", () => {
  assert.equal(
    zonedLocalToUtc({ year: 2026, month: 7, day: 1, hour: 10, minute: 0 }, "Europe/Lisbon").toISOString(),
    "2026-07-01T09:00:00.000Z",
  );
  assert.equal(
    zonedLocalToUtc({ year: 2026, month: 1, day: 1, hour: 10, minute: 0 }, "Europe/Lisbon").toISOString(),
    "2026-01-01T10:00:00.000Z",
  );
});
