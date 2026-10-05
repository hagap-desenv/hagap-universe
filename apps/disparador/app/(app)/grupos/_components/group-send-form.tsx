"use client";
import Link from "next/link";
import { useActionState } from "react";
import { sendGroupAction } from "../actions";

type InstanceOption = { id: string; name: string; phone: string; dailyCap: number };
type VariantOption = { id: string; name: string };

export function GroupSendForm({
  groupId,
  instances,
  variantGroups,
  timezone,
}: {
  groupId: string;
  instances: InstanceOption[];
  variantGroups: VariantOption[];
  timezone: string;
}) {
  const [state, formAction, pending] = useActionState(sendGroupAction, undefined);

  if (instances.length === 0) {
    return (
      <p className="hg-alert hg-alert--error" data-testid="group-send-no-instance">
        Nenhuma instância conectada. Ligue uma instância por QR em <Link href="/">Instâncias</Link> antes de enviar.
      </p>
    );
  }
  if (variantGroups.length === 0) {
    return (
      <p className="hg-alert hg-alert--error">
        Crie antes um grupo em <Link href="/variacoes">Variações de mensagem</Link> (mínimo 3 variações com {"{nome}"}).
      </p>
    );
  }

  const s = state?.summary;
  return (
    <form action={formAction} className="hg-form" aria-busy={pending} data-testid="group-send-form">
      <input type="hidden" name="group_id" value={groupId} />
      {state?.error ? (
        <p className="hg-alert hg-alert--error" role="alert">
          {state.error}
        </p>
      ) : null}
      {s ? (
        <div className="hg-alert hg-alert--success" role="status" data-testid="group-send-summary">
          <p>
            <strong>{s.enfileiradas} mensagem(ns) na fila.</strong>
          </p>
          <p>
            Ignoradas: {s.ignoradas_sem_optin} sem opt-in · {s.ignoradas_optout} com opt-out (pediram para sair) ·{" "}
            {s.ignoradas_outros} por texto repetido (anti-broadcast).
          </p>
        </div>
      ) : null}
      <div className="hg-field">
        <label htmlFor="send-instance">Instância conectada</label>
        <select id="send-instance" name="instance_id" required defaultValue={state?.values?.instance_id?.[0]}>
          {instances.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.phone}) — até {i.dailyCap}/dia
            </option>
          ))}
        </select>
      </div>
      <div className="hg-field">
        <label htmlFor="send-variants">Grupo de variações (mínimo 3, com {"{nome}"})</label>
        <select id="send-variants" name="variant_group_id" required defaultValue={state?.values?.variant_group_id?.[0]}>
          {variantGroups.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="hg-field">
        <label htmlFor="send-when">Agendar para (opcional)</label>
        <input
          id="send-when"
          name="not_before"
          type="datetime-local"
          aria-describedby="send-when-hint"
          defaultValue={state?.values?.not_before?.[0]}
        />
        <small id="send-when-hint">
          Horário da igreja ({timezone}), entre 06:00 e 21:59. Em branco = assim que possível dentro da janela.
        </small>
      </div>
      <div>
        <button type="submit" className="hg-button" disabled={pending}>
          {pending ? "Enfileirando…" : "Enviar notificação para o grupo"}
        </button>
      </div>
    </form>
  );
}
