import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PermissionGate } from "@hagap/core/ui/permission-gate";
import { StatusBadge } from "@hagap/core/ui/status-badge";
import { access } from "@/lib/access";
import { formatDownSince, INSTANCE_STATUS, type InstanceOverview } from "@/lib/instances";
import { createServerSupabase } from "@/lib/supabase/server";
import { ConnectPanel } from "../../_components/connect-panel";
import { WebhookKeyPanel } from "../../_components/webhook-key-panel";

export const metadata: Metadata = { title: "Instância · Disparador HAGAP" };

export default async function InstancePage({ params }: PageProps<"/instancias/[id]">) {
  const { id } = await params;
  const { active } = await access.requirePermission("instancias.view");
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .schema("disparador")
    .rpc("instance_overview", { p_tenant_id: active.tenantId });
  // Só instâncias da igreja ativa (e visíveis pelo RLS)
  const instance = ((data ?? []) as InstanceOverview[]).find((i) => i.id === id);
  if (!instance) notFound();

  const status = INSTANCE_STATUS[instance.status];
  return (
    <>
      <h1>Instância {instance.name}</h1>
      {instance.down_since ? (
        <p className="hg-alert hg-alert--error" role="alert" data-testid="instance-down-alert">
          <span aria-hidden="true">⚠</span> Queda detectada em {formatDownSince(instance.down_since)}: o motor
          parou de enviar por esta instância. Ligue-a de novo por QR.
        </p>
      ) : null}
      <section className="hg-card" aria-labelledby="estado-titulo">
        <h2 id="estado-titulo">Estado</h2>
        <p>
          <StatusBadge tone={status.tone} label={status.label} /> · Número {instance.phone_e164}
        </p>
        <p className="dp-usage" data-testid="daily-usage">
          Uso hoje: {instance.sent_today} de {instance.daily_cap} envios
        </p>
      </section>

      <section className="hg-card" aria-labelledby="fila-titulo">
        <h2 id="fila-titulo">Fila</h2>
        <table className="hg-table" data-testid="queue-panel">
          <caption className="hg-visually-hidden">Mensagens desta instância por estado</caption>
          <thead>
            <tr>
              <th scope="col">Na fila</th>
              <th scope="col">Enviando</th>
              <th scope="col">Enviadas</th>
              <th scope="col">Falhas</th>
              <th scope="col">Adiadas</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{instance.queued}</td>
              <td>{instance.sending}</td>
              <td>{instance.sent}</td>
              <td>{instance.failed}</td>
              <td>{instance.deferred}</td>
            </tr>
          </tbody>
        </table>
        <p className="hg-muted">
          Mensagens entram na fila só pelos produtos (motor com regras anti-ban). Não há envio manual em massa.
        </p>
      </section>

      <PermissionGate permission="instancias.manage">
        <section className="hg-card" aria-labelledby="conexao-titulo">
          <h2 id="conexao-titulo">Conexão (QR)</h2>
          <ConnectPanel instanceId={instance.id} instanceName={instance.name} />
        </section>
        <section className="hg-card" aria-labelledby="chave-titulo">
          <h2 id="chave-titulo">Chave do webhook</h2>
          <WebhookKeyPanel instanceId={instance.id} hasKey={instance.has_webhook_key} />
        </section>
      </PermissionGate>
    </>
  );
}
