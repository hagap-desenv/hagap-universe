import type { Metadata } from "next";
import { visibleApps } from "@hagap/core/app-catalog";
import { access } from "@/lib/access";
import { APP_CATALOG } from "@/lib/apps";
import { createServerSupabase } from "@/lib/supabase/server";
import { Universe } from "./_components/universe";

export const metadata: Metadata = { title: "Apps · Hangap" };

export default async function HubHomePage() {
  const { user, active } = await access.requirePermission("painel.view");
  const supabase = await createServerSupabase();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const name = profile?.full_name?.trim() || user.email || "";
  // Módulos vêm da igreja ativa validada (RLS); cada app ainda valida o acesso por conta própria
  const apps = visibleApps(APP_CATALOG, { role: active.role, modules: active.modules }).map((app) => ({
    key: app.key,
    name: app.name,
    description: app.description,
    url: app.url ?? null,
  }));

  return (
    <Universe apps={apps} tenantName={active.name}>
      <header className="hub-greeting">
        <p className="hub-eyebrow">Seu universo de apps</p>
        <h1>Olá, {name}</h1>
        <p className="hg-muted">
          Escolha um planeta para abrir o app em {active.name}. Passe o mouse sobre o sistema para pausar as órbitas.
        </p>
      </header>
    </Universe>
  );
}
