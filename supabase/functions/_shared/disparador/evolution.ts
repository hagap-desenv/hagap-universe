// EvolutionProvider: adaptador HTTP REST da Evolution API v2 (sem SDK).
// Timeout 10s por chamada (AbortController), sem retry. Credenciais só por env.
import type { ConnectionState, ConnectOptions, EnvGetter, MessagingProvider } from "./provider.ts";
import { TimeoutError } from "./timeout.ts";

export const EVOLUTION_TIMEOUT_MS = 10_000;

// Erro HTTP da Evolution: só operação e status (o corpo pode conter número, nome ou chave)
export class EvolutionHttpError extends Error {
  constructor(readonly op: string, readonly status: number) {
    super(`evolution ${op}: HTTP ${status}`);
    this.name = "EvolutionHttpError";
  }
}

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

  // Provisionamento: cria a instância se não existir, (re)configura SEMPRE o webhook com a chave nova
  // e pede o QR. Cada chamada tem timeout próprio; sem retry.
  async connect(instance: string, opts: ConnectOptions): Promise<{ qrCode?: string }> {
    let exists = true;
    try {
      await this.request("connectionState", "GET", `/instance/connectionState/${enc(instance)}`);
    } catch (error) {
      if (!(error instanceof EvolutionHttpError && error.status === 404)) throw error;
      exists = false;
    }
    if (!exists) {
      await this.request("create", "POST", "/instance/create", {
        instanceName: instance,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      });
    }
    await this.request("webhookSet", "POST", `/webhook/set/${enc(instance)}`, {
      webhook: {
        enabled: true,
        url: opts.webhookUrl,
        headers: { "x-disparador-key": opts.webhookKey },
        byEvents: false,
        base64: false,
        // Mensagens recebidas + estado da conexão (pareamento/queda atualizam o motor sozinhos)
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
      },
    });
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
      if (!res.ok) throw new EvolutionHttpError(op, res.status);
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
