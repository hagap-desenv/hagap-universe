// Hora local da igreja (fuso IANA) ↔ instante UTC. Puro, sem dependências (testável com node:test).

function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instant;
}

export type LocalDateTime = { year: number; month: number; day: number; hour: number; minute: number };

// "YYYY-MM-DDTHH:mm" (input datetime-local) → partes; null se inválido
export function parseLocalDateTime(value: string): LocalDateTime | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return { year, month, day, hour, minute };
}

// Data/hora na parede do fuso → Date (UTC). Duas passagens resolvem mudanças de horário de verão.
export function zonedLocalToUtc(local: LocalDateTime, timeZone: string): Date {
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  let utc = asUtc - offsetMs(asUtc, timeZone);
  utc = asUtc - offsetMs(utc, timeZone);
  return new Date(utc);
}
