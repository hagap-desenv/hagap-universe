import type { Metadata } from "next";
import Link from "next/link";
import { PermissionGate } from "@hagap/core/ui/permission-gate";
import { access } from "@/lib/access";
import { GROUP_SELECT, toContactGroup } from "@/lib/groups";
import { disparadorPermissions } from "@/lib/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { GroupCreateForm } from "./_components/group-create-form";
import { GroupMembersDialog } from "./_components/group-members-dialog";
import { GroupRowActions } from "./_components/group-row-actions";

export const metadata: Metadata = { title: "Grupos · Disparador HAGAP" };

export default async function GroupsPage() {
  const { active } = await access.requirePermission("grupos.view");
  const canManage = disparadorPermissions.can(active.role, "grupos.manage");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .schema("disparador")
    .from("contact_groups")
    .select(GROUP_SELECT)
    .eq("tenant_id", active.tenantId)
    .order("name");
  const groups = ((data ?? []) as Parameters<typeof toContactGroup>[0][]).map(toContactGroup);

  return (
    <>
      <h1>Grupos de contatos</h1>
      <p className="hg-muted">
        Listas de celulares da igreja (não são grupos do WhatsApp). O envio para um grupo vira mensagens individuais e
        personalizadas, só para quem deu opt-in.
      </p>
      <PermissionGate permission="grupos.manage">
        <section className="hg-card" aria-labelledby="novo-grupo-contatos">
          <h2 id="novo-grupo-contatos">Novo grupo</h2>
          <GroupCreateForm />
        </section>
      </PermissionGate>
      {error ? (
        <p className="hg-alert hg-alert--error" role="alert">
          Não foi possível carregar os grupos.
        </p>
      ) : groups.length === 0 ? (
        <p>Nenhum grupo nesta igreja.</p>
      ) : (
        <table className="hg-table" data-testid="groups-table">
          <caption>Grupos da igreja</caption>
          <thead>
            <tr>
              <th scope="col">Grupo</th>
              <th scope="col">Membros</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} data-testid={`group-row-${g.name}`}>
                <th scope="row">
                  {g.name}
                  {g.description ? <div className="hg-muted">{g.description}</div> : null}
                </th>
                <td data-testid="group-member-count">{g.members.length}</td>
                <td>
                  <div className="dp-actions">
                    <GroupMembersDialog group={g} canManage={canManage} />
                    <Link href={`/grupos/${g.id}`} className="hg-button hg-button--secondary">
                      {canManage ? "Enviar notificação" : "Ver envios"}
                      <span className="hg-visually-hidden"> do grupo {g.name}</span>
                    </Link>
                    {canManage ? <GroupRowActions groupId={g.id} name={g.name} /> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
