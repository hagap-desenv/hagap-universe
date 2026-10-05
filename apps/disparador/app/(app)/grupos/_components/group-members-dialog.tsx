"use client";
// Popup "Ver celulares": <dialog> nativo modal (foco preso pelo navegador, Esc fecha), rotulado pelo título,
// foco inicial no botão Fechar e devolvido ao botão que abriu. A lista se atualiza após cada ação
// (revalidação do servidor) sem recarregar a página nem fechar o popup.
import { useActionState, useRef, useState } from "react";
import { StatusBadge } from "@hagap/core/ui/status-badge";
import type { ContactGroup, GroupMember } from "@/lib/groups";
import { addMemberAction, removeMemberAction, updateMemberAction } from "../actions";

function Consent({ m }: { m: GroupMember }) {
  if (m.opted_out_at) return <StatusBadge tone="critico" label="Saiu (opt-out)" />;
  if (m.opted_in_at) return <StatusBadge tone="bem" label="Opt-in" />;
  return <StatusBadge tone="neutro" label="Sem opt-in" />;
}

function Feedback({ state }: { state: { error?: string; message?: string } | undefined }) {
  if (state?.error) {
    return (
      <p className="hg-alert hg-alert--error" role="alert">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p className="hg-alert hg-alert--success" role="status">
        {state.message}
      </p>
    );
  }
  return null;
}

function MemberRow({ groupId, m, canManage }: { groupId: string; m: GroupMember; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof updateMemberAction>>, formData: FormData) => {
      const result = await updateMemberAction(prev, formData);
      if (result?.message) setEditing(false);
      return result;
    },
    undefined,
  );
  const base = `member-${groupId}-${m.id}`;

  return (
    <tr data-testid="member-row">
      <th scope="row">
        {editing ? (
          <form id={`${base}-form`} action={formAction} className="hg-form" aria-busy={pending}>
            <input type="hidden" name="contact_id" value={m.id} />
            <div className="hg-field">
              <label htmlFor={`${base}-name`}>Nome</label>
              <input id={`${base}-name`} name="name" required defaultValue={m.name} />
            </div>
            {m.opted_out_at ? (
              <p className="hg-muted">Pediu para sair (opt-out): só a própria pessoa pode voltar a receber.</p>
            ) : (
              <div className="hg-checkbox">
                <input id={`${base}-optin`} name="opt_in" type="checkbox" defaultChecked={!!m.opted_in_at} />
                <label htmlFor={`${base}-optin`}>Autorizou receber mensagens (opt-in)</label>
              </div>
            )}
          </form>
        ) : (
          m.name
        )}
        <Feedback state={state} />
      </th>
      <td>{m.phone_e164}</td>
      <td>
        <Consent m={m} />
      </td>
      {canManage ? (
        <td>
          <div className="dp-actions">
            {editing ? (
              <>
                <button type="submit" form={`${base}-form`} className="hg-button" disabled={pending}>
                  Salvar
                </button>
                <button type="button" className="hg-button hg-button--ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <button type="button" className="hg-button hg-button--secondary" onClick={() => setEditing(true)}>
                Editar<span className="hg-visually-hidden"> {m.name}</span>
              </button>
            )}
            <form action={removeMemberAction}>
              <input type="hidden" name="group_id" value={groupId} />
              <input type="hidden" name="contact_id" value={m.id} />
              <button type="submit" className="hg-button hg-button--ghost">
                Remover do grupo<span className="hg-visually-hidden"> {m.name}</span>
              </button>
            </form>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function AddMemberForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(addMemberAction, undefined);
  const base = `add-${groupId}`;
  return (
    <form action={formAction} className="hg-form" aria-busy={pending} data-testid="add-member-form">
      <h3>Adicionar número</h3>
      <Feedback state={state} />
      <input type="hidden" name="group_id" value={groupId} />
      <div className="hg-field">
        <label htmlFor={`${base}-name`}>Nome</label>
        <input id={`${base}-name`} name="name" required autoComplete="off" defaultValue={state?.values?.name?.[0]} />
      </div>
      <div className="hg-field">
        <label htmlFor={`${base}-phone`}>Celular (formato internacional)</label>
        <input
          id={`${base}-phone`}
          name="phone"
          type="tel"
          required
          placeholder="+5511999990000"
          autoComplete="off"
          aria-describedby={`${base}-phone-hint`}
          defaultValue={state?.values?.phone?.[0]}
        />
        <small id={`${base}-phone-hint`}>
          Se o número já existir na igreja, ele só é vinculado ao grupo. Para trocar um número, remova o antigo e
          adicione o novo.
        </small>
      </div>
      <div className="hg-checkbox">
        <input
          id={`${base}-optin`}
          name="opt_in"
          type="checkbox"
          defaultChecked={state?.values?.opt_in?.[0] === "on"}
        />
        <label htmlFor={`${base}-optin`}>A pessoa autorizou receber mensagens (opt-in registrado)</label>
      </div>
      <div>
        <button type="submit" className="hg-button" disabled={pending}>
          {pending ? "Adicionando…" : "Adicionar ao grupo"}
        </button>
      </div>
    </form>
  );
}

export function GroupMembersDialog({ group, canManage }: { group: ContactGroup; canManage: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `celulares-${group.id}`;

  const open = () => {
    dialogRef.current?.showModal();
    closeRef.current?.focus();
  };
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button ref={openerRef} type="button" className="hg-button" onClick={open}>
        Ver celulares<span className="hg-visually-hidden"> do grupo {group.name}</span>
      </button>
      <dialog
        ref={dialogRef}
        className="dp-dialog"
        aria-labelledby={titleId}
        data-testid="group-members-dialog"
        onClose={() => openerRef.current?.focus()}
      >
        <div className="dp-dialog__header">
          <h2 id={titleId}>Celulares do grupo {group.name}</h2>
          <button ref={closeRef} type="button" className="hg-button hg-button--ghost" onClick={close}>
            Fechar
          </button>
        </div>
        {group.members.length === 0 ? (
          <p>Nenhum celular neste grupo.</p>
        ) : (
          <table className="hg-table">
            <caption className="hg-visually-hidden">Membros do grupo {group.name}</caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Celular</th>
                <th scope="col">Consentimento</th>
                {canManage ? <th scope="col">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {group.members.map((m) => (
                <MemberRow key={m.id} groupId={group.id} m={m} canManage={canManage} />
              ))}
            </tbody>
          </table>
        )}
        {canManage ? <AddMemberForm groupId={group.id} /> : null}
      </dialog>
    </>
  );
}
