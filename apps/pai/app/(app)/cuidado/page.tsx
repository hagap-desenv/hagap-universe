import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CareStatusBadge } from "@hagap/core/ui/status-badge";
import { access } from "@/lib/access";

export const metadata: Metadata = { title: "Cuidado · PAI Cuidado" };

export default async function CuidadoPage() {
  const { active } = await access.requirePermission("cuidado.view");
  // Módulo desligado na igreja → a área não existe para ela
  if (!active.modules.includes("cuidado")) notFound();

  return (
    <>
      <h1>Cuidado</h1>
      <section className="hg-card" aria-labelledby="legenda-titulo">
        <h2 id="legenda-titulo">Estados de cuidado</h2>
        <p>Cada pessoa acompanhada terá um destes estados, sempre com ícone e texto:</p>
        <ul className="pai-legend">
          <li>
            <CareStatusBadge status="bem" />
          </li>
          <li>
            <CareStatusBadge status="atencao" />
          </li>
          <li>
            <CareStatusBadge status="critico" />
          </li>
        </ul>
      </section>
      <p className="hg-muted">Cadastro de pessoas em cuidado e check-ins chegam nas próximas entregas.</p>
    </>
  );
}
