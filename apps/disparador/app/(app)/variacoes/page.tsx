import type { Metadata } from "next";
import { PermissionGate } from "@hagap/core/ui/permission-gate";
import { StatusBadge } from "@hagap/core/ui/status-badge";
import { access } from "@/lib/access";
import { createServerSupabase } from "@/lib/supabase/server";
import { VariantGroupForm } from "../_components/variant-group-form";

export const metadata: Metadata = { title: "Variações · Disparador HAGAP" };

type Group = { id: string; name: string; variants: { id: string; template: string }[] | null };

export default async function VariantsPage() {
  const { active } = await access.requirePermission("variacoes.view");
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .schema("disparador")
    .from("variant_groups")
    .select("id, name, variants(id, template)")
    .eq("tenant_id", active.tenantId)
    .order("name");
  const groups = (data ?? []) as Group[];

  return (
    <>
      <h1>Variações de mensagem</h1>
      <p className="hg-muted">
        Aberturas e campanhas usam um grupo com pelo menos 3 variações, todas com <code>{"{nome}"}</code>: cada
        pessoa recebe um texto personalizado e diferente (nunca broadcast).
      </p>
      <PermissionGate permission="variacoes.manage">
        <section className="hg-card" aria-labelledby="novo-grupo-titulo">
          <h2 id="novo-grupo-titulo">Novo grupo</h2>
          <VariantGroupForm />
        </section>
      </PermissionGate>
      {groups.length === 0 ? (
        <p>Nenhum grupo de variações nesta igreja.</p>
      ) : (
        groups.map((g) => {
          const count = g.variants?.length ?? 0;
          return (
            <section key={g.id} className="hg-card" aria-labelledby={`grupo-${g.id}`}>
              <h2 id={`grupo-${g.id}`}>{g.name}</h2>
              <p>
                {count >= 3 ? (
                  <StatusBadge tone="bem" label={`${count} variações`} />
                ) : (
                  <StatusBadge tone="atencao" label={`${count} variações (mínimo 3)`} />
                )}
              </p>
              <ol>
                {(g.variants ?? []).map((v) => (
                  <li key={v.id}>{v.template}</li>
                ))}
              </ol>
            </section>
          );
        })
      )}
    </>
  );
}
