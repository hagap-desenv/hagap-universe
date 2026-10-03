import type { Metadata } from "next";
import { access } from "@/lib/access";
import { NewInstanceForm } from "../../_components/new-instance-form";

export const metadata: Metadata = { title: "Nova instância · Disparador HAGAP" };

export default async function NewInstancePage() {
  // Só admin da igreja (o RLS também recusa para os demais)
  const { active } = await access.requirePermission("instancias.manage");
  return (
    <>
      <h1>Nova instância</h1>
      <p className="hg-muted">
        Igreja: <strong>{active.name}</strong>. Use um número dedicado ao serviço (nunca o celular pessoal do pastor
        ou do administrador).
      </p>
      <section className="hg-card">
        <NewInstanceForm />
      </section>
    </>
  );
}
