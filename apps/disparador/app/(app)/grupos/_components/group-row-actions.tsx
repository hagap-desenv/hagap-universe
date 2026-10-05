"use client";
import { useActionState, useState } from "react";
import { deleteGroupAction, renameGroupAction } from "../actions";

// Renomear (inline) e excluir grupo (com confirmação). Só admin/coordenador.
export function GroupRowActions({ groupId, name }: { groupId: string; name: string }) {
  const [renaming, setRenaming] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof renameGroupAction>>, formData: FormData) => {
      const result = await renameGroupAction(prev, formData);
      if (result?.message) setRenaming(false);
      return result;
    },
    undefined,
  );
  const inputId = `rename-${groupId}`;

  return (
    <>
      {renaming ? (
        <form action={formAction} className="hg-form hg-form--inline" aria-busy={pending}>
          <input type="hidden" name="group_id" value={groupId} />
          <div className="hg-field">
            <label htmlFor={inputId}>Novo nome do grupo {name}</label>
            <input id={inputId} name="name" required defaultValue={name} />
          </div>
          <button type="submit" className="hg-button" disabled={pending}>
            Salvar nome
          </button>
          <button type="button" className="hg-button hg-button--ghost" onClick={() => setRenaming(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button type="button" className="hg-button hg-button--secondary" onClick={() => setRenaming(true)}>
          Renomear<span className="hg-visually-hidden"> o grupo {name}</span>
        </button>
      )}
      {state?.error ? (
        <p className="hg-alert hg-alert--error" role="alert">
          {state.error}
        </p>
      ) : null}
      <form
        action={deleteGroupAction}
        onSubmit={(e) => {
          if (!window.confirm(`Excluir o grupo "${name}"? Os contatos continuam cadastrados na igreja.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="group_id" value={groupId} />
        <button type="submit" className="hg-button hg-button--ghost">
          Excluir<span className="hg-visually-hidden"> o grupo {name}</span>
        </button>
      </form>
    </>
  );
}
