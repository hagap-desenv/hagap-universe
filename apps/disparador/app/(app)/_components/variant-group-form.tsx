"use client";
import { useActionState } from "react";
import { createVariantGroupAction } from "../actions";

const SLOTS = [1, 2, 3, 4, 5];

export function VariantGroupForm() {
  const [state, formAction, pending] = useActionState(createVariantGroupAction, undefined);
  return (
    <form action={formAction} className="hg-form" aria-busy={pending}>
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
        <label htmlFor="group-name">Nome do grupo</label>
        <input id="group-name" name="name" required />
      </div>
      <fieldset className="dp-templates">
        <legend>Variações (mínimo 3, todas com {"{nome}"})</legend>
        {SLOTS.map((n) => (
          <div className="hg-field" key={n}>
            <label htmlFor={`template-${n}`}>
              Variação {n}
              {n <= 3 ? " (obrigatória)" : " (opcional)"}
            </label>
            <textarea id={`template-${n}`} name="template" rows={2} required={n <= 3} />
          </div>
        ))}
      </fieldset>
      <div>
        <button type="submit" className="hg-button" disabled={pending}>
          {pending ? "Criando…" : "Criar grupo"}
        </button>
      </div>
    </form>
  );
}
