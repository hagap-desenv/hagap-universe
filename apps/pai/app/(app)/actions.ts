"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@hagap/core/auth";
import { access, TENANT_COOKIE } from "@/lib/access";
import { createServerSupabase } from "@/lib/supabase/server";

export async function switchTenantAction(formData: FormData): Promise<void> {
  // Validação no servidor: só aceita igrejas das memberships do usuário
  await access.setActiveTenant(formData.get("tenantId"));
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await signOut([TENANT_COOKIE]);
}

export type SettingsState = { error?: string; message?: string } | undefined;

export async function saveTenantSettingsAction(_state: SettingsState, formData: FormData): Promise<SettingsState> {
  // Tenant vem do contexto validado, nunca do formulário
  const { active } = await access.requirePermission("tenant.configure");
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("set_tenant_settings", {
    p_tenant_id: active.tenantId,
    p_name: String(formData.get("name") ?? ""),
    p_timezone: String(formData.get("timezone") ?? ""),
  });
  if (error) {
    return { error: error.code === "22023" ? "Nome ou fuso horário inválido." : "Não foi possível salvar." };
  }
  revalidatePath("/", "layout");
  return { message: "Configurações salvas." };
}
