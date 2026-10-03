"use client";
import { useActionState } from "react";
import { addContactAction } from "../actions";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(addContactAction, undefined);
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
        <label htmlFor="contact-name">Nome</label>
        <input id="contact-name" name="name" required autoComplete="off" />
      </div>
      <div className="hg-field">
        <label htmlFor="contact-phone">Número (formato internacional)</label>
        <input id="contact-phone" name="phone" type="tel" required placeholder="+5511999990000" autoComplete="off" />
      </div>
      <div className="hg-checkbox">
        <input id="contact-optin" name="opt_in" type="checkbox" />
        <label htmlFor="contact-optin">A pessoa autorizou receber mensagens (opt-in registrado)</label>
      </div>
      <div>
        <button type="submit" className="hg-button" disabled={pending}>
          {pending ? "Salvando…" : "Salvar contato"}
        </button>
      </div>
    </form>
  );
}
