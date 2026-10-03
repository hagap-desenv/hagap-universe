"use client";
import { useActionState } from "react";
import { createInstanceAction } from "../actions";

export function NewInstanceForm() {
  const [state, formAction, pending] = useActionState(createInstanceAction, undefined);
  return (
    <form action={formAction} className="hg-form" aria-busy={pending}>
      {state?.error ? (
        <p className="hg-alert hg-alert--error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="hg-field">
        <label htmlFor="instance-name">Nome técnico</label>
        <input
          id="instance-name"
          name="name"
          required
          defaultValue={state?.values?.name?.[0]}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          aria-describedby="instance-name-hint"
        />
        <small id="instance-name-hint">Minúsculas, números e hífen. Ex.: igreja-centro-01.</small>
      </div>
      <div className="hg-field">
        <label htmlFor="instance-phone">Número (formato internacional)</label>
        <input
          id="instance-phone"
          name="phone"
          defaultValue={state?.values?.phone?.[0]}
          type="tel"
          required
          placeholder="+5511999990000"
          aria-describedby="instance-phone-hint"
        />
        <small id="instance-phone-hint">Um número só pode ter uma instância.</small>
      </div>
      <div className="hg-field">
        <label htmlFor="instance-cap">Limite diário de envios</label>
        <input
          id="instance-cap"
          name="daily_cap"
          type="number"
          min={1}
          max={50}
          defaultValue={state?.values?.daily_cap?.[0] ?? 30}
          required
          aria-describedby="instance-cap-hint"
        />
        <small id="instance-cap-hint">Seguro: 30. Máximo: 50.</small>
      </div>
      <div>
        <button type="submit" className="hg-button" disabled={pending}>
          {pending ? "Criando…" : "Criar instância"}
        </button>
      </div>
    </form>
  );
}
