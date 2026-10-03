import type { Tone } from "@hagap/core/ui/status-badge";

export type InstanceStatus = "disconnected" | "connecting" | "open";

export type InstanceOverview = {
  id: string;
  name: string;
  phone_e164: string;
  status: InstanceStatus;
  daily_cap: number;
  sent_today: number;
  queued: number;
  sending: number;
  sent: number;
  failed: number;
  deferred: number;
  has_webhook_key: boolean;
  // Queda (evento do motor) mais recente que a última conexão; null = sem alerta
  down_since: string | null;
};

// Data/hora da queda para o alerta (UTC explícito: o servidor não conhece o fuso do usuário)
export function formatDownSince(iso: string): string {
  return `${new Date(iso).toLocaleString("pt-BR", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" })} UTC`;
}

// Estado da instância: tom + texto (cor nunca sozinha)
export const INSTANCE_STATUS: Record<InstanceStatus, { tone: Tone; label: string }> = {
  open: { tone: "bem", label: "Conectada" },
  connecting: { tone: "atencao", label: "Aguardando QR" },
  disconnected: { tone: "critico", label: "Desconectada" },
};

export const E164 = /^\+[1-9][0-9]{7,14}$/;

// Nome técnico da instância na Evolution: minúsculas, números e hífen
export const INSTANCE_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
