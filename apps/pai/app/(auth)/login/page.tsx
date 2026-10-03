import type { Metadata } from "next";
import { AuthLayout, LoginForm } from "@hagap/core/ui/auth-forms";
import { safeRedirectPath } from "@hagap/core/tenant";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Entrar · PAI Cuidado" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : undefined);
  const notice = params.erro === "link" ? "O link expirou ou é inválido. Peça um novo." : undefined;
  return (
    <AuthLayout appName="PAI Cuidado" title="Entrar">
      <LoginForm action={loginAction} next={next} notice={notice} />
    </AuthLayout>
  );
}
