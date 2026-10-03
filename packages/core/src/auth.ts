// Fluxos de autenticação (login, logout, reset de senha) chamados pelas Server Actions dos apps.
// Mensagens genéricas: nunca revelar se um e-mail existe.
import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "./supabase/server";
import { safeRedirectPath } from "./tenant";

export type FormState = { error?: string; message?: string } | undefined;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function signInWithPassword(formData: FormData): Promise<FormState> {
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "E-mail ou senha inválidos." };

  redirect(safeRedirectPath(formData.get("next")));
}

export async function signOut(cookieNamesToClear: readonly string[] = []): Promise<never> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  for (const name of cookieNamesToClear) cookieStore.delete(name);
  redirect("/login");
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
}

export async function requestPasswordReset(formData: FormData): Promise<FormState> {
  const email = field(formData, "email");
  if (!email) return { error: "Informe o e-mail." };

  const supabase = await createServerSupabase();
  const origin = await requestOrigin();
  // Erro (ex.: limite de envio) não muda a resposta: evita enumeração de contas
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/atualizar-senha`,
  });
  return {
    message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
  };
}

export async function updatePassword(formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== confirm) return { error: "As senhas não coincidem." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Não foi possível atualizar a senha. Peça um novo link." };
  redirect("/");
}

// Route Handler de /auth/callback: troca o código (PKCE) ou o token_hash do e-mail por sessão
export async function handleAuthCallback(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));
  const supabase = await createServerSupabase();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const origin = request.nextUrl.origin;
  return NextResponse.redirect(new URL(ok ? next : "/login?erro=link", origin));
}
