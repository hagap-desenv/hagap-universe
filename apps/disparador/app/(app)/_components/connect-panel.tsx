"use client";
import { useActionState } from "react";
import { StatusBadge } from "@hagap/core/ui/status-badge";
import { INSTANCE_STATUS } from "@/lib/instances";
import { connectInstanceAction } from "../actions";

export function ConnectPanel({ instanceId, instanceName }: { instanceId: string; instanceName: string }) {
  const [state, formAction, pending] = useActionState(connectInstanceAction, undefined);
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
        {state?.status ? (
          <p data-testid="connect-result">
            <StatusBadge tone={INSTANCE_STATUS[state.status].tone} label={INSTANCE_STATUS[state.status].label} />
            {state.status === "open" ? " A instância já está conectada." : null}
          </p>
        ) : null}
        {state?.qrCode ? (
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
          </>
        ) : null}
      </div>
      <div>
        <button type="submit" className="hg-button" disabled={pending}>
          {pending ? "Conectando…" : "Ligar por QR"}
        </button>
      </div>
    </form>
  );
}
