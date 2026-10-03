"use client";
import { useActionState } from "react";
import { rotateWebhookKeyAction } from "../actions";

// A chave aparece uma única vez (resposta da action); o banco guarda só o hash
export function WebhookKeyPanel({ instanceId, hasKey }: { instanceId: string; hasKey: boolean }) {
  const [state, formAction, pending] = useActionState(rotateWebhookKeyAction, undefined);

  return (
    <form action={formAction} className="hg-form" aria-busy={pending}>
      <input type="hidden" name="instance_id" value={instanceId} />
      <p>
        {hasKey || state?.key
          ? "Há uma chave ativa. Gerar outra invalida a anterior imediatamente."
          : "Nenhuma chave gerada. O webhook recusa eventos até existir uma."}
      </p>
      <div aria-live="polite">
        {state?.error ? (
          <p className="hg-alert hg-alert--error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state?.key ? (
          <div className="hg-alert hg-alert--info">
            <p>
              <strong>Copie agora:</strong> esta chave não será mostrada de novo. Configure-a no header{" "}
              <code>x-disparador-key</code> do webhook da instância.
            </p>
            <p className="hg-code" data-testid="webhook-key">
              {state.key}
            </p>
          </div>
        ) : null}
      </div>
      <div>
        <button type="submit" className="hg-button hg-button--secondary" disabled={pending}>
          {pending ? "Gerando…" : hasKey || state?.key ? "Rotacionar chave" : "Gerar chave"}
        </button>
      </div>
    </form>
  );
}
