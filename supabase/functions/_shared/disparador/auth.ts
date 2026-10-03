// Autenticação das EFs do Disparador: comparação em tempo constante, falha fechada.

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// Segredo partilhado (ex.: x-cron-secret): compara os digests, nunca aceita vazio
export async function secretMatches(
  provided: string | null | undefined,
  expected: string | null | undefined,
): Promise<boolean> {
  if (!provided || !expected) return false;
  const [a, b] = await Promise.all([sha256Hex(provided), sha256Hex(expected)]);
  return constantTimeEqual(a, b);
}

// Chave da instância (ex.: x-disparador-key) contra o sha256 hex guardado no banco
export async function keyMatchesHash(
  provided: string | null | undefined,
  expectedHashHex: string | null | undefined,
): Promise<boolean> {
  if (!provided || !expectedHashHex) return false;
  return constantTimeEqual(await sha256Hex(provided), expectedHashHex.trim().toLowerCase());
}
