import type { Metadata } from "next";
import { AuthLayout, ResetRequestForm } from "@hagap/core/ui/auth-forms";
import { resetRequestAction } from "../actions";

export const metadata: Metadata = { title: "Redefinir senha · Disparador HAGAP" };

export default function ResetPasswordPage() {
  return (
    <AuthLayout appName="Disparador HAGAP" title="Redefinir senha">
      <ResetRequestForm action={resetRequestAction} />
    </AuthLayout>
  );
}
