// FakeProvider: adaptador em memória com estados controláveis (testes e HOM sem Evolution).
import type { ConnectionState, ConnectOptions, MessagingProvider } from "./provider.ts";

export type FakeSent = {
  instance: string;
  toE164: string;
  body: string;
  providerMessageId: string;
};

export class FakeProvider implements MessagingProvider {
  readonly name = "fake";
  readonly sent: FakeSent[] = [];
  readonly healthChecks: string[] = [];
  // Último webhook configurado por instância (provisionamento no connect)
  readonly webhooks = new Map<string, ConnectOptions>();
  private states = new Map<string, ConnectionState>();
  private sendFailures = new Map<string, Error>();
  private hanging = new Set<string>();
  private stateFailures = new Map<string, Error>();
  private hangingState = new Set<string>();
  private seq = 0;

  constructor(private defaultState: ConnectionState = "open") {}

  setState(instance: string, state: ConnectionState): void {
    this.states.set(instance, state);
  }

  failSend(instance: string, error = new Error("fake send failure")): void {
    this.sendFailures.set(instance, error);
  }

  failState(instance: string, error = new Error("fake state failure")): void {
    this.stateFailures.set(instance, error);
  }

  // Envio que nunca responde (simula timeout sem deixar timers pendentes)
  hangSend(instance: string): void {
    this.hanging.add(instance);
  }

  hangState(instance: string): void {
    this.hangingState.add(instance);
  }

  connectionState(instance: string): Promise<ConnectionState> {
    this.healthChecks.push(instance);
    if (this.hangingState.has(instance)) return new Promise(() => {});
    const failure = this.stateFailures.get(instance);
    if (failure) return Promise.reject(failure);
    return Promise.resolve(this.states.get(instance) ?? this.defaultState);
  }

  sendText(instance: string, toE164: string, body: string): Promise<{ providerMessageId: string }> {
    if (this.hanging.has(instance)) return new Promise(() => {});
    const failure = this.sendFailures.get(instance);
    if (failure) return Promise.reject(failure);
    const providerMessageId = `fake-${++this.seq}`;
    this.sent.push({ instance, toE164, body, providerMessageId });
    return Promise.resolve({ providerMessageId });
  }

  connect(instance: string, opts: ConnectOptions): Promise<{ qrCode?: string }> {
    this.webhooks.set(instance, { ...opts });
    if ((this.states.get(instance) ?? this.defaultState) === "open") return Promise.resolve({});
    this.states.set(instance, "connecting");
    return Promise.resolve({ qrCode: `fake-qr:${instance}` });
  }
}
