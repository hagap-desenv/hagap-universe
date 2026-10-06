import type { Metadata } from "next";
import { LoginForm } from "@hagap/core/ui/auth-forms";
import { safeRedirectPath } from "@hagap/core/tenant";
import { loginAction } from "../actions";
import { BrandLayout } from "../_components/brand-layout";

export const metadata: Metadata = { title: "Entrar · Hangap" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : undefined);
  const notice = params.erro === "link" ? "O link expirou ou é inválido. Peça um novo." : undefined;
  return (
    <BrandLayout title="Entrar" intro="Acesse os apps da sua igreja com seu e-mail e senha.">
      <LoginForm action={loginAction} next={next} notice={notice} />
    </BrandLayout>
  );
}
