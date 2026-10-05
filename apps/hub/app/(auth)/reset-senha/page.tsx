import type { Metadata } from "next";
import { ResetRequestForm } from "@hagap/core/ui/auth-forms";
import { BrandLayout } from "../_components/brand-layout";
import { resetRequestAction } from "../actions";

export const metadata: Metadata = { title: "Redefinir senha · Hangap" };

export default function ResetPasswordPage() {
  return (
    <BrandLayout title="Redefinir senha">
      <ResetRequestForm action={resetRequestAction} />
    </BrandLayout>
  );
}
