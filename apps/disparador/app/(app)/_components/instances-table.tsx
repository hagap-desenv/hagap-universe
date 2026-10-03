import Link from "next/link";
import { StatusBadge } from "@hagap/core/ui/status-badge";
import { INSTANCE_STATUS, type InstanceOverview } from "@/lib/instances";

// Painel de fila por instância: estado, uso de hoje vs cap e mensagens por status
export function InstancesTable({ instances }: { instances: readonly InstanceOverview[] }) {
  return (
    <table className="hg-table" data-testid="instances-table">
      <caption>Instâncias, uso diário e fila</caption>
      <thead>
        <tr>
          <th scope="col">Instância</th>
          <th scope="col">Número</th>
          <th scope="col">Estado</th>
          <th scope="col">Uso hoje</th>
          <th scope="col">Na fila</th>
          <th scope="col">Enviando</th>
          <th scope="col">Enviadas</th>
          <th scope="col">Falhas</th>
        </tr>
      </thead>
      <tbody>
        {instances.map((i) => {
          const status = INSTANCE_STATUS[i.status];
          const capReached = i.sent_today >= i.daily_cap;
          return (
            <tr key={i.id}>
              <th scope="row">
                <Link href={`/instancias/${i.id}`}>{i.name}</Link>
              </th>
              <td>{i.phone_e164}</td>
              <td>
                <StatusBadge tone={status.tone} label={status.label} />
              </td>
              <td className="dp-usage">
                {i.sent_today} de {i.daily_cap}
                {capReached ? (
                  <>
                    {" "}
                    <StatusBadge tone="atencao" label="limite atingido" />
                  </>
                ) : null}
              </td>
              <td>{i.queued}</td>
              <td>{i.sending}</td>
              <td>{i.sent}</td>
              <td>{i.failed}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
