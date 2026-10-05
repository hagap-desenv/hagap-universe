"use server";
// Server Actions dos grupos de contatos. Escrita via RLS/RPC com o JWT do usuário; tenant do contexto validado.
// Telefone e igreja do contato nunca mudam pelo cliente (identidade do opt-out — QA Q9); opt-out não é desfeito.
import { revalidatePath } from "next/cache";
import { parseLocalDateTime, zonedLocalToUtc } from "@hagap/core/time";
import { access } from "@/lib/access";
import { WINDOW_END_HOUR, WINDOW_START_HOUR } from "@/lib/groups";
import { E164 } from "@/lib/instances";
import { createServerSupabase } from "@/lib/supabase/server";

export type GroupState = { error?: string; message?: string; values?: Record<string, string[]> } | undefined;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function keepValues(formData: FormData, state: GroupState): GroupState {
  if (!state?.error) return state;
  const values: Record<string, string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) (values[key] ??= []).push(value);
  }
  return { ...state, values };
}

const refresh = () => revalidatePath("/grupos", "layout");

// ===== Grupo =====
export async function createGroupAction(_state: GroupState, formData: FormData): Promise<GroupState> {
  return keepValues(formData, await createGroup(formData));
}

async function createGroup(formData: FormData): Promise<GroupState> {
  const { active } = await access.requirePermission("grupos.manage");
  const name = text(formData, "name");
  if (!name) return { error: "Informe o nome do grupo." };
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .schema("disparador")
    .from("contact_groups")
    .insert({ tenant_id: active.tenantId, name, description: text(formData, "description") || null });
  if (error) {
    if (error.code === "23505") return { error: "Já existe um grupo com este nome." };
    return { error: "Não foi possível criar o grupo." };
  }
  refresh();
  return { message: `Grupo "${name}" criado.` };
}

export async function renameGroupAction(_state: GroupState, formData: FormData): Promise<GroupState> {
  await access.requirePermission("grupos.manage");
  const name = text(formData, "name");
  if (!name) return { error: "Informe o novo nome." };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .schema("disparador")
    .from("contact_groups")
    .update({ name })
    .eq("id", text(formData, "group_id"))
    .select("id");
  if (error) return { error: error.code === "23505" ? "Já existe um grupo com este nome." : "Não foi possível renomear." };
  if (!data?.length) return { error: "Sem permissão para este grupo." };
  refresh();
  return { message: "Grupo renomeado." };
}

export async function deleteGroupAction(formData: FormData): Promise<void> {
  await access.requirePermission("grupos.manage");
  const supabase = await createServerSupabase();
  // Apaga só o grupo e os vínculos; os contatos (e seus opt-in/opt-out) continuam na igreja
  await supabase.schema("disparador").from("contact_groups").delete().eq("id", text(formData, "group_id"));
  refresh();
}

// ===== Membros (popup "Ver celulares") =====
export async function addMemberAction(_state: GroupState, formData: FormData): Promise<GroupState> {
  return keepValues(formData, await addMember(formData));
}

async function addMember(formData: FormData): Promise<GroupState> {
  await access.requirePermission("grupos.manage");
  const name = text(formData, "name");
  const phone = text(formData, "phone").replace(/[\s()-]/g, "");
  if (!name) return { error: "Informe o nome." };
  if (!E164.test(phone)) return { error: "Número no formato internacional, ex.: +5511999990000." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.schema("disparador").rpc("add_group_member", {
    p_group_id: text(formData, "group_id"),
    p_name: name,
    p_phone_e164: phone,
    p_opt_in: formData.get("opt_in") === "on",
  });
  if (error) return { error: error.code === "42501" ? "Sem permissão para este grupo." : "Não foi possível adicionar." };
  const existed = Array.isArray(data) && (data[0] as { existed?: boolean } | undefined)?.existed;
  refresh();
  return {
    message: existed
      ? `${phone} já estava cadastrado na igreja: vinculado ao grupo (dados do contato mantidos).`
      : `${name} adicionado ao grupo.`,
  };
}

export async function updateMemberAction(_state: GroupState, formData: FormData): Promise<GroupState> {
  await access.requirePermission("grupos.manage");
  const name = text(formData, "name");
  if (!name) return { error: "Informe o nome." };
  const supabase = await createServerSupabase();
  // Um query builder por chamada (o builder do postgrest-js não é reutilizável)
  const contacts = () => supabase.schema("disparador").from("contacts");
  const contactId = text(formData, "contact_id");

  const { data: current } = await contacts().select("opted_in_at, opted_out_at").eq("id", contactId).maybeSingle();
  if (!current) return { error: "Contato não encontrado." };

  // Opt-out só a própria pessoa desfaz: com opt-out, só o nome muda
  const patch: { name: string; opted_in_at?: string | null } = { name };
  if (!current.opted_out_at) {
    const wantsOptIn = formData.get("opt_in") === "on";
    if (wantsOptIn && !current.opted_in_at) patch.opted_in_at = new Date().toISOString();
    if (!wantsOptIn && current.opted_in_at) patch.opted_in_at = null;
  }
  const { data, error } = await contacts().update(patch).eq("id", contactId).select("id");
  if (error || !data?.length) return { error: "Não foi possível salvar (sem permissão?)." };
  refresh();
  return { message: "Contato atualizado." };
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  await access.requirePermission("grupos.manage");
  const supabase = await createServerSupabase();
  await supabase
    .schema("disparador")
    .from("contact_group_members")
    .delete()
    .eq("group_id", text(formData, "group_id"))
    .eq("contact_id", text(formData, "contact_id"));
  refresh();
}

// ===== Enviar notificação para o grupo =====
export type SendGroupState =
  | (GroupState & {
      summary?: { enfileiradas: number; ignoradas_sem_optin: number; ignoradas_optout: number; ignoradas_outros: number };
    })
  | undefined;

export async function sendGroupAction(_state: SendGroupState, formData: FormData): Promise<SendGroupState> {
  const result = await sendGroup(formData);
  return result?.error ? (keepValues(formData, result) as SendGroupState) : result;
}

async function sendGroup(formData: FormData): Promise<SendGroupState> {
  const { active } = await access.requirePermission("grupos.manage");
  const instanceId = text(formData, "instance_id");
  const variantGroupId = text(formData, "variant_group_id");
  if (!instanceId) return { error: "Escolha uma instância conectada." };
  if (!variantGroupId) return { error: "Escolha um grupo de variações." };

  let notBefore: string | null = null;
  const when = text(formData, "not_before");
  if (when) {
    const local = parseLocalDateTime(when);
    if (!local) return { error: "Data/hora inválida." };
    if (local.hour < WINDOW_START_HOUR || local.hour >= WINDOW_END_HOUR) {
      return { error: "Agende entre 06:00 e 21:59 (horário da igreja)." };
    }
    notBefore = zonedLocalToUtc(local, active.timezone).toISOString();
  }

  const supabase = await createServerSupabase();
  // Só instância CONECTADA da igreja ativa (RLS + filtro)
  const { data: instance } = await supabase
    .schema("disparador")
    .from("instances")
    .select("id, status")
    .eq("id", instanceId)
    .eq("tenant_id", active.tenantId)
    .maybeSingle();
  if (!instance) return { error: "Instância não encontrada nesta igreja." };
  if (instance.status !== "open") return { error: "A instância não está conectada. Ligue-a por QR antes de enviar." };

  const { data, error } = await supabase.schema("disparador").rpc("enqueue_group", {
    p_group_id: text(formData, "group_id"),
    p_instance_id: instanceId,
    p_variant_group_id: variantGroupId,
    p_not_before: notBefore,
  });
  if (error) {
    const byCode: Record<string, string> = {
      DS003: "O grupo de variações precisa de pelo menos 3 variações com {nome}.",
      "42501": "Sem permissão para enviar para este grupo.",
      "22023": "Grupo de variações inválido para esta igreja.",
    };
    return { error: byCode[error.code] ?? "Não foi possível enfileirar o envio." };
  }
  const summary = (Array.isArray(data) ? data[0] : data) as NonNullable<SendGroupState>["summary"];
  refresh();
  return { summary, message: "Envio registrado." };
}
