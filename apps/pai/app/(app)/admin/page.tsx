import type { Metadata } from "next";
import { ROLE_LABELS, isAppRole } from "@hagap/core/roles";
import { StatusBadge } from "@hagap/core/ui/status-badge";
import { access } from "@/lib/access";
import { createServerSupabase } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Administração · PAI Cuidado" };

type MemberRow = {
  role: string;
  active: boolean;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function AdminPage() {
  // Guard de servidor: mentor/coordenador recebem 404
  const { active } = await access.requirePermission("admin.view");
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("tenant_memberships")
    .select("role, active, profiles(full_name, email)")
    .eq("tenant_id", active.tenantId)
    .order("role");
  const members = (data ?? []) as unknown as MemberRow[];

  return (
    <>
      <h1>Administração</h1>
      <section className="hg-card" aria-labelledby="config-titulo">
        <h2 id="config-titulo">Configurações da igreja</h2>
        <SettingsForm name={active.name} timezone={active.timezone} />
      </section>
      <section className="hg-card" aria-labelledby="membros-titulo">
        <h2 id="membros-titulo">Membros</h2>
        <table className="hg-table">
          <caption className="hg-visually-hidden">Membros da igreja e seus papéis</caption>
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">E-mail</th>
              <th scope="col">Papel</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={`${m.profiles?.email ?? "membro"}-${i}`}>
                <td>{m.profiles?.full_name ?? "—"}</td>
                <td>{m.profiles?.email ?? "—"}</td>
                <td>{isAppRole(m.role) ? ROLE_LABELS[m.role] : m.role}</td>
                <td>
                  {m.active ? <StatusBadge tone="bem" label="Ativo" /> : <StatusBadge tone="neutro" label="Inativo" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
