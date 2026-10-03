import type { Metadata } from "next";
import Link from "next/link";
import { ROLE_LABELS, isAppRole } from "@hagap/core/roles";
import { formatCnpj } from "@hagap/core/tenant";
import { PermissionGate } from "@hagap/core/ui/permission-gate";
import { access } from "@/lib/access";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Início · PAI Cuidado" };

export default async function HomePage() {
  const { active } = await access.requirePermission("inicio.view");
  const supabase = await createServerSupabase();
  // RLS + filtro explícito pelo tenant ativo validado
  const { data } = await supabase
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", active.tenantId)
    .eq("active", true);

  const byRole = new Map<string, number>();
  for (const row of data ?? []) byRole.set(row.role, (byRole.get(row.role) ?? 0) + 1);

  return (
    <>
      <h1>{active.name}</h1>
      <div className="pai-grid">
        <section className="hg-card" aria-labelledby="igreja-titulo">
          <h2 id="igreja-titulo">Igreja</h2>
          <dl className="pai-dl">
            <dt>CNPJ</dt>
            <dd data-testid="tenant-cnpj">{formatCnpj(active.cnpj)}</dd>
            <dt>Fuso horário</dt>
            <dd>{active.timezone}</dd>
            <dt>Módulos ativos</dt>
            <dd>{active.modules.length ? active.modules.join(", ") : "nenhum"}</dd>
          </dl>
        </section>
        <section className="hg-card" aria-labelledby="equipe-titulo">
          <h2 id="equipe-titulo">Equipe</h2>
          <ul>
            {[...byRole.entries()].map(([role, count]) => (
              <li key={role}>
                {isAppRole(role) ? ROLE_LABELS[role] : role}: {count}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <PermissionGate permission="admin.view">
        <p>
          <Link href="/admin">Configurar a igreja</Link>
        </p>
      </PermissionGate>
    </>
  );
}
