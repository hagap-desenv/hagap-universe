import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { access } from "@/lib/access";
import { type CampaignProgress, campaignSignature, GROUP_SELECT, toContactGroup } from "@/lib/groups";
import type { InstanceOverview } from "@/lib/instances";
import { disparadorPermissions } from "@/lib/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { CampaignAutoRefresh } from "../_components/campaign-auto-refresh";
import { GroupMembersDialog } from "../_components/group-members-dialog";
import { GroupSendForm } from "../_components/group-send-form";

export const metadata: Metadata = { title: "Enviar para grupo · Disparador HAGAP" };

export default async function GroupPage({ params }: PageProps<"/grupos/[id]">) {
  const { id } = await params;
  const { active } = await access.requirePermission("grupos.view");
  const canManage = disparadorPermissions.can(active.role, "grupos.manage");
  const supabase = await createServerSupabase();
  const db = () => supabase.schema("disparador");

  const { data: row } = await db()
    .from("contact_groups")
    .select(GROUP_SELECT)
    .eq("id", id)
    .eq("tenant_id", active.tenantId)
    .maybeSingle();
  if (!row) notFound();
  const group = toContactGroup(row as Parameters<typeof toContactGroup>[0]);

  const [{ data: overview }, { data: variantGroups }, { data: campaignsData }] = await Promise.all([
    db().rpc("instance_overview", { p_tenant_id: active.tenantId }),
    db().from("variant_groups").select("id, name, variants(id)").eq("tenant_id", active.tenantId).order("name"),
    db().rpc("group_campaigns", { p_group_id: group.id }),
  ]);
  const connected = ((overview ?? []) as InstanceOverview[])
    .filter((i) => i.status === "open")
    .map((i) => ({ id: i.id, name: i.name, phone: i.phone_e164, dailyCap: i.daily_cap }));
  const usableVariants = ((variantGroups ?? []) as { id: string; name: string; variants: { id: string }[] | null }[])
    .filter((v) => (v.variants?.length ?? 0) >= 3)
    .map((v) => ({ id: v.id, name: v.name }));
  const campaigns = (campaignsData ?? []) as CampaignProgress[];
  const optedIn = group.members.filter((m) => m.opted_in_at && !m.opted_out_at).length;

  return (
    <>
      <p>
        <Link href="/grupos">← Voltar para os grupos</Link>
      </p>
      <h1>Grupo {group.name}</h1>
      <section className="hg-card" aria-labelledby="membros-resumo">
        <h2 id="membros-resumo">Membros</h2>
        <p data-testid="group-optin-summary">
          {group.members.length} celular(es), {optedIn} com opt-in (só estes recebem).
        </p>
        <GroupMembersDialog group={group} canManage={canManage} />
      </section>

      {canManage ? (
        <section className="hg-card" aria-labelledby="enviar-titulo">
          <h2 id="enviar-titulo">Enviar notificação para o grupo</h2>
          <p className="hg-alert hg-alert--info">
            Cada pessoa recebe uma mensagem individual, personalizada com o nome, sorteada entre as variações. Limite de
            até 30 mensagens por dia por número (o limite da instância), com 45–90s entre mensagens e só das 06h às
            22h: um grupo grande sai em vários dias, automaticamente.
          </p>
          <GroupSendForm
            groupId={group.id}
            instances={connected}
            variantGroups={usableVariants}
            timezone={active.timezone}
          />
        </section>
      ) : null}

      <section className="hg-card" aria-labelledby="envios-titulo">
        <h2 id="envios-titulo">Envios para este grupo</h2>
        {campaigns.length === 0 ? (
          <p>Nenhum envio para este grupo ainda.</p>
        ) : (
          <table className="hg-table" data-testid="group-campaigns">
            <caption className="hg-visually-hidden">Acompanhamento dos envios para o grupo {group.name}</caption>
            <thead>
              <tr>
                <th scope="col">Envio</th>
                <th scope="col">Na fila</th>
                <th scope="col">Enviando</th>
                <th scope="col">Enviadas</th>
                <th scope="col">Falhas</th>
                <th scope="col">Ignoradas</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaign_id}>
                  <th scope="row">{c.name}</th>
                  <td>{c.queued}</td>
                  <td>{c.sending}</td>
                  <td>{c.sent}</td>
                  <td>{c.failed + c.cancelled}</td>
                  <td>
                    sem opt-in: {c.ignoradas_sem_optin} · opt-out: {c.ignoradas_optout} · outros: {c.ignoradas_outros}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <CampaignAutoRefresh
          groupId={group.id}
          signatures={Object.fromEntries(campaigns.map((c) => [c.campaign_id, campaignSignature(c)]))}
        />
      </section>
    </>
  );
}
