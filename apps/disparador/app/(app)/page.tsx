import type { Metadata } from "next";
import Link from "next/link";
import { PermissionGate } from "@hagap/core/ui/permission-gate";
import { access } from "@/lib/access";
import type { InstanceOverview } from "@/lib/instances";
import { createServerSupabase } from "@/lib/supabase/server";
import { InstancesTable } from "./_components/instances-table";
import { StatusAutoRefresh } from "./_components/status-auto-refresh";

export const metadata: Metadata = { title: "Instâncias · Disparador HAGAP" };

export default async function InstancesPage() {
  const { active } = await access.requirePermission("instancias.view");
  const supabase = await createServerSupabase();
  // SECURITY INVOKER: o RLS garante que só aparecem instâncias da igreja do usuário
  const { data, error } = await supabase
    .schema("disparador")
    .rpc("instance_overview", { p_tenant_id: active.tenantId });
  const instances = (data ?? []) as InstanceOverview[];

  return (
    <>
      <h1>Instâncias WhatsApp</h1>
      <p className="hg-muted">
        Uma instância por número. Envio sequencial com intervalo de 45–90s, janela 06h–22h (hora local) e limite
        diário por instância.
      </p>
      <PermissionGate permission="instancias.manage">
        <p>
          <Link href="/instancias/nova" className="hg-button">
            Nova instância
          </Link>
        </p>
      </PermissionGate>
      {error ? (
        <p className="hg-alert hg-alert--error" role="alert">
          Não foi possível carregar as instâncias.
        </p>
      ) : instances.length === 0 ? (
        <p data-testid="no-instances">Nenhuma instância cadastrada nesta igreja.</p>
      ) : (
        <>
          <InstancesTable instances={instances} />
          <StatusAutoRefresh statuses={Object.fromEntries(instances.map((i) => [i.id, i.status]))} />
        </>
      )}
    </>
  );
}
