import type { Metadata } from "next";
import { UpdatePasswordForm } from "@hagap/core/ui/auth-forms";
import { BrandLayout } from "../_components/brand-layout";
import { updatePasswordAction } from "../actions";

export const metadata: Metadata = { title: "Nova senha · Hangap" };

// Protegida pelo proxy: chega-se aqui com a sessão criada pelo link de recuperação (/auth/callback)
export default function UpdatePasswordPage() {
  return (
    <BrandLayout title="Definir nova senha">
      <UpdatePasswordForm action={updatePasswordAction} />
    </BrandLayout>
  );
}
