// EvolutionProvider: adaptador HTTP REST da Evolution API v2 (sem SDK).
// Timeout 10s por chamada (AbortController), sem retry. Credenciais só por env.
import type { ConnectionState, EnvGetter, MessagingProvider } from "./provider.ts";
import { TimeoutError } from "./timeout.ts";

export const EVOLUTION_TIMEOUT_MS = 10_000;

export type EvolutionOptions = {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

type Json = Record<string, unknown>;

export class EvolutionProvider implements MessagingProvider {
  readonly name = "evolution";
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: EvolutionOptions) {
    this.baseUrl = (options.baseUrl ?? "").trim().replace(/\/+$/, "");
    this.apiKey = (options.apiKey ?? "").trim();
    if (!this.baseUrl || !this.apiKey) {
      throw new Error("EVOLUTION_API_URL/EVOLUTION_API_KEY ausentes");
    }
    this.doFetch = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? EVOLUTION_TIMEOUT_MS;
  }

  async connectionState(instance: string): Promise<ConnectionState> {
    const data = await this.request(
      "connectionState",
      "GET",
      `/instance/connectionState/${enc(instance)}`,
    );
    const state = (data.instance as Json | undefined)?.state ?? data.state;
    if (state === "open") return "open";
    if (state === "connecting") return "connecting";
    return "close";
  }

  async sendText(instance: string, toE164: string, body: string) {
    const data = await this.request("sendText", "POST", `/message/sendText/${enc(instance)}`, {
      number: toE164.replace(/^\+/, ""),
      text: body,
    });
    const id = (data.key as Json | undefined)?.id;
    if (typeof id !== "string" || id === "") {
      throw new Error("evolution sendText: resposta sem key.id");
    }
    return { providerMessageId: id };
  }

  async connect(instance: string): Promise<{ qrCode?: string }> {
    const data = await this.request("connect", "GET", `/instance/connect/${enc(instance)}`);
    const qr = data.base64 ?? data.code;
    return typeof qr === "string" && qr !== "" ? { qrCode: qr } : {};
  }

  private async request(op: string, method: string, path: string, body?: Json): Promise<Json> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let res: Response;
      try {
        res = await this.doFetch(`${this.baseUrl}${path}`, {
          method,
          headers: { "apikey": this.apiKey, "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } catch {
        if (controller.signal.aborted) throw new TimeoutError();
        throw new Error(`evolution ${op}: falha de rede`);
      }
      const text = await res.text();
      // Nunca propagar o corpo de erro (pode conter número/conteúdo)
      if (!res.ok) throw new Error(`evolution ${op}: HTTP ${res.status}`);
      if (text.trim() === "") return {};
      try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" ? parsed as Json : {};
      } catch {
        throw new Error(`evolution ${op}: resposta inválida`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

const enc = (instance: string) => encodeURIComponent(instance);

export function evolutionFromEnv(env: EnvGetter): EvolutionProvider {
  return new EvolutionProvider({
    baseUrl: env("EVOLUTION_API_URL") ?? "",
    apiKey: env("EVOLUTION_API_KEY") ?? "",
  });
}
