"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@hagap/core/auth";
import { access, TENANT_COOKIE } from "@/lib/access";

export async function switchTenantAction(formData: FormData): Promise<void> {
  // Só aceita igrejas das memberships do usuário (validação no servidor)
  await access.setActiveTenant(formData.get("tenantId"));
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await signOut([TENANT_COOKIE]);
}
