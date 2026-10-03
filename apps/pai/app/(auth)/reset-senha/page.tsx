import type { Metadata } from "next";
import { AuthLayout, ResetRequestForm } from "@hagap/core/ui/auth-forms";
import { resetRequestAction } from "../actions";

export const metadata: Metadata = { title: "Redefinir senha · PAI Cuidado" };

export default function ResetPasswordPage() {
  return (
    <AuthLayout appName="PAI Cuidado" title="Redefinir senha">
      <ResetRequestForm action={resetRequestAction} />
    </AuthLayout>
  );
}
