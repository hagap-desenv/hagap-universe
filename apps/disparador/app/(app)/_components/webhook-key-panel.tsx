"use client";
import { useActionState } from "react";
import { renewWebhookKeyAction } from "../actions";

// A chave do webhook nunca é exibida (regra primordial: segredos não aparecem). Renovar gera uma chave nova,
// guarda só o hash no banco e aplica a mesma chave no provedor, sem dessincronizar.
export function WebhookKeyPanel({ instanceId, hasKey }: { instanceId: string; hasKey: boolean }) {
  const [state, formAction, pending] = useActionState(renewWebhookKeyAction, undefined);

  return (
    <form action={formAction} className="hg-form" aria-busy={pending}>
      <input type="hidden" name="instance_id" value={instanceId} />
      <p>
        {hasKey
          ? "Há uma chave ativa, configurada automaticamente no provedor. Ela nunca é exibida."
          : "Nenhuma chave ainda: ela é criada automaticamente ao ligar a instância por QR."}
      </p>
      <div aria-live="polite">
        {state?.error ? (
          <p className="hg-alert hg-alert--error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state?.message ? (
          <p className="hg-alert hg-alert--success" role="status" data-testid="webhook-key-renewed">
            {state.message}
          </p>
        ) : null}
      </div>
      <div>
        <button type="submit" className="hg-button hg-button--secondary" disabled={pending}>
          {pending ? "Renovando…" : "Renovar chave"}
        </button>
      </div>
    </form>
  );
}
