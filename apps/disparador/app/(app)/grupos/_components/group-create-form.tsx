"use client";
import { useActionState } from "react";
import { createGroupAction } from "../actions";

export function GroupCreateForm() {
  const [state, formAction, pending] = useActionState(createGroupAction, undefined);
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
        <label htmlFor="contact-group-name">Nome do grupo</label>
        <input id="contact-group-name" name="name" required defaultValue={state?.values?.name?.[0]} />
      </div>
      <div className="hg-field">
        <label htmlFor="contact-group-description">Descrição (opcional)</label>
        <input id="contact-group-description" name="description" defaultValue={state?.values?.description?.[0]} />
      </div>
      <div>
        <button type="submit" className="hg-button" disabled={pending}>
          {pending ? "Criando…" : "Criar grupo de contatos"}
        </button>
      </div>
    </form>
  );
}
