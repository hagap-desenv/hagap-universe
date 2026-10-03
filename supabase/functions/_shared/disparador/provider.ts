// Porta de mensageria do Disparador: o motor fala só com esta interface.
// Escolha do adaptador por env (DISPARADOR_PROVIDER=fake|evolution), nunca por código.

export type ConnectionState = "open" | "connecting" | "close";

export interface MessagingProvider {
  readonly name: string;
  connectionState(instance: string): Promise<ConnectionState>;
  sendText(instance: string, toE164: string, body: string): Promise<{ providerMessageId: string }>;
  connect(instance: string): Promise<{ qrCode?: string }>;
}

export type EnvGetter = (key: string) => string | undefined;

export type ProviderFactories = {
  fake: () => MessagingProvider;
  evolution: (env: EnvGetter) => MessagingProvider;
};

// Sem default: ausente, vazio ou desconhecido = erro (nunca cair silenciosamente no fake)
export function getProvider(env: EnvGetter, factories: ProviderFactories): MessagingProvider {
  const choice = (env("DISPARADOR_PROVIDER") ?? "").trim().toLowerCase();
  if (!choice) throw new Error("DISPARADOR_PROVIDER não definido (fake|evolution)");
  if (choice === "fake") return factories.fake();
  if (choice === "evolution") return factories.evolution(env);
  throw new Error(`DISPARADOR_PROVIDER inválido: ${choice}`);
}
