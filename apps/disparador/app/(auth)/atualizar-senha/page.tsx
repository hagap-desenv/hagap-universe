import type { Metadata } from "next";
import { AuthLayout, UpdatePasswordForm } from "@hagap/core/ui/auth-forms";
import { updatePasswordAction } from "../actions";

export const metadata: Metadata = { title: "Nova senha · Disparador HAGAP" };

// Protegida pelo proxy: chega-se aqui com a sessão criada pelo link de recuperação (/auth/callback)
export default function UpdatePasswordPage() {
  return (
    <AuthLayout appName="Disparador HAGAP" title="Definir nova senha">
      <UpdatePasswordForm action={updatePasswordAction} />
    </AuthLayout>
  );
}
