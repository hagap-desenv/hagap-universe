"use client";
import { useActionState } from "react";
import { saveTenantSettingsAction } from "../actions";

export function SettingsForm({ name, timezone }: { name: string; timezone: string }) {
  const [state, formAction, pending] = useActionState(saveTenantSettingsAction, undefined);
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
        <label htmlFor="settings-name">Nome da igreja</label>
        <input id="settings-name" name="name" defaultValue={name} required />
      </div>
      <div className="hg-field">
        <label htmlFor="settings-timezone">Fuso horário (IANA)</label>
        <input id="settings-timezone" name="timezone" defaultValue={timezone} required />
      </div>
      <div>
        <button type="submit" className="hg-button" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
