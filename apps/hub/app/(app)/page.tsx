import type { Metadata } from "next";
import { visibleApps } from "@hagap/core/app-catalog";
import { access } from "@/lib/access";
import { APP_CATALOG } from "@/lib/apps";
import { createServerSupabase } from "@/lib/supabase/server";
import { AppIcon } from "./_components/app-icon";

export const metadata: Metadata = { title: "Apps · Hangap" };

export default async function HubHomePage() {
  const { user, active } = await access.requirePermission("painel.view");
  const supabase = await createServerSupabase();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const name = profile?.full_name?.trim() || user.email || "";
  // Módulos vêm da igreja ativa validada (RLS); cada app ainda valida o acesso por conta própria
  const apps = visibleApps(APP_CATALOG, { role: active.role, modules: active.modules });

  return (
    <>
      <h1>Olá, {name}</h1>
      <p className="hg-muted">Escolha o app que deseja usar em {active.name}.</p>
      {apps.length === 0 ? (
        <div className="hg-card" data-testid="no-apps">
          <h2>Nenhum app habilitado para esta igreja</h2>
          <p>Quando a plataforma liberar um app para a sua igreja e o seu papel, ele aparece aqui.</p>
        </div>
      ) : (
        <ul className="hub-grid" aria-label="Apps disponíveis">
          {apps.map((app) => (
            <li key={app.key}>
              <article className="hub-card" data-testid={`app-card-${app.key}`} aria-labelledby={`app-${app.key}`}>
                <AppIcon appKey={app.key} />
                <h2 id={`app-${app.key}`}>{app.name}</h2>
                <p>{app.description}</p>
                {app.url ? (
                  <a className="hg-button hub-card__open" href={app.url}>
                    Abrir<span className="hg-visually-hidden"> {app.name}</span>
                  </a>
                ) : (
                  <p className="hg-muted">Endereço do app ainda não configurado.</p>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
