// Timeout sem deixar timers pendentes.
export class TimeoutError extends Error {
  constructor() {
    super("timeout");
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Rótulo curto e sem dados pessoais para registar falhas
export function errorLabel(error: unknown): string {
  if (error instanceof TimeoutError) return "timeout";
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 200);
}
