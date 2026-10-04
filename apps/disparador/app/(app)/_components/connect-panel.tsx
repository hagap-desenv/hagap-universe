"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { StatusBadge } from "@hagap/core/ui/status-badge";
import { INSTANCE_STATUS } from "@/lib/instances";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { connectInstanceAction, type ConnectState } from "../actions";

// Enquanto o QR está na tela, consulta o estado (RLS) até a leitura no celular ou expirar
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_MS = 120_000;

type Phase = "connected" | "expired";

export function ConnectPanel({ instanceId, instanceName }: { instanceId: string; instanceName: string }) {
  const [state, formAction, pending] = useActionState(connectInstanceAction, undefined);
  const router = useRouter();
  // Resultado do polling ligado ao QR que o gerou (um QR novo recomeça a espera)
  const [poll, setPoll] = useState<{ source: ConnectState; phase: Phase } | null>(null);
  const phase = poll && poll.source === state ? poll.phase : null;
  const waitingForScan = !!state?.qrCode && state.status !== "open" && phase === null;

  useEffect(() => {
    if (!state?.qrCode || state.status === "open") return;
    const supabase = createBrowserSupabase();
    const startedAt = Date.now();
    let stopped = false;
    const timer = setInterval(async () => {
      if (stopped) return;
      if (Date.now() - startedAt > POLL_MAX_MS) {
        stopped = true;
        clearInterval(timer);
        setPoll({ source: state, phase: "expired" });
        return;
      }
      const { data } = await supabase
        .schema("disparador")
        .from("instances")
        .select("status")
        .eq("id", instanceId)
        .maybeSingle();
      if (stopped || data?.status !== "open") return;
      stopped = true;
      clearInterval(timer);
      setPoll({ source: state, phase: "connected" });
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [state, instanceId, router]);

  const isImage = state?.qrCode?.startsWith("data:image/");

  return (
    <form action={formAction} className="hg-form" aria-busy={pending}>
      <input type="hidden" name="instance_id" value={instanceId} />
      <div aria-live="polite">
        {state?.error ? (
          <p className="hg-alert hg-alert--error" role="alert">
            {state.error}
          </p>
        ) : null}
        {phase === "connected" ? (
          <p data-testid="connect-result">
            <StatusBadge tone={INSTANCE_STATUS.open.tone} label={INSTANCE_STATUS.open.label} /> Pareamento
            concluído.
          </p>
        ) : phase === "expired" ? (
          <p className="hg-alert hg-alert--info" data-testid="connect-expired">
            O QR expirou sem leitura. Gere um novo QR para tentar de novo.
          </p>
        ) : state?.status ? (
          <p data-testid="connect-result">
            <StatusBadge tone={INSTANCE_STATUS[state.status].tone} label={INSTANCE_STATUS[state.status].label} />
            {state.status === "open" ? " A instância já está conectada." : null}
          </p>
        ) : null}
        {waitingForScan && state?.qrCode ? (
          <>
            <p>No celular da igreja: WhatsApp → Aparelhos conectados → Conectar aparelho → leia o QR.</p>
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- QR em data URL vindo do provedor
              <img className="dp-qr" src={state.qrCode} alt={`QR code para conectar a instância ${instanceName}`} />
            ) : (
              <pre className="hg-code" aria-label="Código de pareamento">
                {state.qrCode}
              </pre>
            )}
            <p className="hg-muted" data-testid="connect-waiting">
              Aguardando a leitura do QR… o estado atualiza sozinho.
            </p>
          </>
        ) : null}
      </div>
      <div>
        <button type="submit" className="hg-button" disabled={pending}>
          {pending ? "Conectando…" : phase === "expired" ? "Gerar novo QR" : "Ligar por QR"}
        </button>
      </div>
    </form>
  );
}
