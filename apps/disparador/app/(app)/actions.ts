"use server";
// Server Actions do Disparador. Toda escrita passa por RLS/RPC com o JWT do usuário;
// o tenant vem sempre do contexto validado no servidor, nunca do formulário.
// Não há envio manual em massa: a fila só é alimentada por disparador.enqueue_message.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@hagap/core/auth";
import { getSupabasePublicEnv } from "@hagap/core/env";
import { access, TENANT_COOKIE } from "@/lib/access";
import { E164, INSTANCE_NAME, type InstanceStatus } from "@/lib/instances";
import { createServerSupabase } from "@/lib/supabase/server";

export type ActionState = { error?: string; message?: string } | undefined;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function switchTenantAction(formData: FormData): Promise<void> {
  await access.setActiveTenant(formData.get("tenantId"));
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await signOut([TENANT_COOKIE]);
}

// ===== Instâncias (só admin) =====
export async function createInstanceAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { active } = await access.requirePermission("instancias.manage");
  const name = text(formData, "name").toLowerCase();
  const phone = text(formData, "phone").replace(/[\s()-]/g, "");
  const cap = Number(text(formData, "daily_cap") || "30");

  if (!INSTANCE_NAME.test(name)) return { error: "Nome técnico: use letras minúsculas, números e hífen." };
  if (!E164.test(phone)) return { error: "Número no formato internacional, ex.: +5511999990000." };
  if (!Number.isInteger(cap) || cap < 1 || cap > 50) return { error: "Limite diário entre 1 e 50 (seguro: 30)." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .schema("disparador")
    .from("instances")
    .insert({ tenant_id: active.tenantId, name, phone_e164: phone, daily_cap: cap })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Já existe uma instância com este nome ou número." };
    if (error.code === "42501") return { error: "Sem permissão para criar instâncias nesta igreja." };
    return { error: "Não foi possível criar a instância." };
  }
  revalidatePath("/");
  redirect(`/instancias/${data.id}`);
}

export type KeyState = { error?: string; key?: string } | undefined;

// Chave do webhook: devolvida uma única vez; o banco guarda só o sha256
export async function rotateWebhookKeyAction(_state: KeyState, formData: FormData): Promise<KeyState> {
  await access.requirePermission("instancias.manage");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .schema("disparador")
    .rpc("rotate_webhook_key", { p_instance_id: text(formData, "instance_id") });
  if (error || typeof data !== "string") {
    return { error: error?.code === "42501" ? "Sem permissão para esta instância." : "Não foi possível gerar a chave." };
  }
  revalidatePath("/", "layout");
  return { key: data };
}

export type ConnectState = { error?: string; status?: InstanceStatus; qrCode?: string } | undefined;

// Ligar por QR: chama a EF disparador-instance-connect com o JWT do próprio usuário
export async function connectInstanceAction(_state: ConnectState, formData: FormData): Promise<ConnectState> {
  await access.requirePermission("instancias.manage");
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Sessão expirada. Entre novamente." };

  const { url, anonKey } = getSupabasePublicEnv();
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/disparador-instance-connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ instance_id: text(formData, "instance_id") }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { error: "Serviço de conexão indisponível. Tente de novo em instantes." };
  }

  if (res.status === 401 || res.status === 403) return { error: "Sem permissão para ligar esta instância." };
  if (!res.ok) return { error: "O provedor não respondeu. Tente de novo em instantes." };
  const body = (await res.json()) as { status?: InstanceStatus; qr_code?: string };
  revalidatePath("/", "layout");
  return { status: body.status, qrCode: body.qr_code };
}

// ===== Contatos (admin/coordenador) =====
export async function addContactAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { active } = await access.requirePermission("contatos.manage");
  const name = text(formData, "name");
  const phone = text(formData, "phone").replace(/[\s()-]/g, "");
  const consent = formData.get("opt_in") === "on";

  if (!name) return { error: "Informe o nome do contato." };
  if (!E164.test(phone)) return { error: "Número no formato internacional, ex.: +5511999990000." };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .schema("disparador")
    .from("contacts")
    .insert({
      tenant_id: active.tenantId,
      name,
      phone_e164: phone,
      source: "manual",
      opted_in_at: consent ? new Date().toISOString() : null,
    });
  if (error) {
    if (error.code === "23505") return { error: "Este número já está cadastrado nesta igreja." };
    return { error: "Não foi possível salvar o contato." };
  }
  revalidatePath("/contatos");
  return { message: "Contato salvo." };
}

export async function setContactConsentAction(formData: FormData): Promise<void> {
  await access.requirePermission("contatos.manage");
  const optIn = formData.get("consent") === "opt_in";
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  await supabase
    .schema("disparador")
    .from("contacts")
    .update(optIn ? { opted_in_at: now, opted_out_at: null } : { opted_out_at: now })
    .eq("id", text(formData, "contact_id"));
  revalidatePath("/contatos");
}

// ===== Grupos de variações (admin/coordenador): ≥ 3 variações com {nome} =====
export async function createVariantGroupAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { active } = await access.requirePermission("variacoes.manage");
  const name = text(formData, "name");
  const templates = formData
    .getAll("template")
    .map((t) => String(t).trim())
    .filter(Boolean);

  if (!name) return { error: "Informe o nome do grupo." };
  if (templates.length < 3) return { error: "Escreva pelo menos 3 variações." };
  if (templates.some((t) => !t.includes("{nome}"))) {
    return { error: "Todas as variações precisam conter {nome} (mensagem personalizada)." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.schema("disparador").rpc("create_variant_group", {
    p_tenant_id: active.tenantId,
    p_name: name,
    p_templates: templates,
  });
  if (error) {
    if (error.code === "23505") return { error: "Já existe um grupo com este nome." };
    if (error.code === "42501") return { error: "Sem permissão para criar grupos nesta igreja." };
    return { error: "Não foi possível criar o grupo." };
  }
  revalidatePath("/variacoes");
  return { message: "Grupo criado." };
}
