// Grupos de contatos (listas da igreja) e acompanhamento das campanhas enviadas a eles.

export type GroupMember = {
  id: string;
  name: string;
  phone_e164: string;
  opted_in_at: string | null;
  opted_out_at: string | null;
};

export type ContactGroup = {
  id: string;
  name: string;
  description: string | null;
  members: GroupMember[];
};

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  contact_group_members: { contacts: GroupMember | GroupMember[] | null }[] | null;
};

export const GROUP_SELECT =
  "id, name, description, contact_group_members(contacts(id, name, phone_e164, opted_in_at, opted_out_at))";

export function toContactGroup(row: GroupRow): ContactGroup {
  const members = (row.contact_group_members ?? [])
    .flatMap((m) => (Array.isArray(m.contacts) ? m.contacts : m.contacts ? [m.contacts] : []))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { id: row.id, name: row.name, description: row.description, members };
}

export type CampaignProgress = {
  campaign_id: string;
  name: string;
  created_at: string;
  instance_id: string | null;
  enfileiradas: number;
  ignoradas_sem_optin: number;
  ignoradas_optout: number;
  ignoradas_outros: number;
  queued: number;
  sending: number;
  sent: number;
  failed: number;
  cancelled: number;
};

// Assinatura do acompanhamento: a tela se atualiza sozinha quando muda (server e client usam a mesma)
export const campaignSignature = (c: Pick<CampaignProgress, "queued" | "sending" | "sent" | "failed" | "cancelled">) =>
  [c.queued, c.sending, c.sent, c.failed, c.cancelled].join("|");

// Janela de envio (hora local da igreja): 06:00 até antes das 22:00
export const WINDOW_START_HOUR = 6;
export const WINDOW_END_HOUR = 22;
