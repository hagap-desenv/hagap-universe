"use client";
import { useActionState } from "react";
import { sendTestMessageAction } from "../actions";

export type VariantGroupOption = { id: string; name: string };

// Envia UMA mensagem de teste por esta instância (pelo motor, com as mesmas regras anti-ban)
export function TestMessageForm({ instanceId, groups }: { instanceId: string; groups: VariantGroupOption[] }) {
  const [state, formAction, pending] = useActionState(sendTestMessageAction, undefined);

  if (groups.length === 0) {
    return (
      <p className="hg-muted" data-testid="test-message-no-groups">
        Crie antes um grupo em <a href="/variacoes">Variações de mensagem</a> (mínimo 3 variações com {"{nome}"}).
      </p>
    );
  }

  return (
    <form action={formAction} className="hg-form" aria-busy={pending} data-testid="test-message-form">
      <input type="hidden" name="instance_id" value={instanceId} />
      {state?.error ? (
        <p className="hg-alert hg-alert--error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.message ? (
        <p className="hg-alert hg-alert--success" role="status">
          {state.message}
        </p>
      ) : null}
      <div className="hg-field">
        <label htmlFor="test-group">Grupo de variações</label>
        <select id="test-group" name="variant_group_id" required defaultValue={state?.values?.variant_group_id?.[0]}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div className="hg-field">
        <label htmlFor="test-name">Nome de quem recebe (substitui o {"{nome}"})</label>
        <input id="test-name" name="name" required autoComplete="off" defaultValue={state?.values?.name?.[0]} />
      </div>
      <div className="hg-field">
        <label htmlFor="test-phone">Número de destino (formato internacional, diferente do número da instância)</label>
        <input
          id="test-phone"
          name="phone"
          type="tel"
          required
          placeholder="+5511999990000"
          autoComplete="off"
          defaultValue={state?.values?.phone?.[0]}
        />
      </div>
      <div>
        <button type="submit" className="hg-button" disabled={pending}>
          {pending ? "Enviando para a fila…" : "Enviar mensagem de teste"}
        </button>
      </div>
    </form>
  );
}
