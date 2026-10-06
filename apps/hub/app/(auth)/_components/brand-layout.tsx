import { HangapLogo } from "@hagap/core/ui/hangap-logo";
import { BRAND_LOGO_SRC, BRAND_MOTTO, BRAND_TAGLINE } from "@/lib/brand";
import { ReplayIntroButton, SpaceIntro } from "./space-intro";

// Telas de acesso do hub: fundo de espaço com o vídeo do sistema solar + marca + cartão do formulário.
// withIntro: o vídeo toca primeiro em tela cheia e o login aparece aos poucos (só no login).
export function BrandLayout({
  title,
  intro,
  withIntro = false,
  children,
}: {
  title: string;
  intro?: string;
  withIntro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main id="conteudo" className="hub-auth">
      {/* Sem JavaScript o login aparece direto */}
      <noscript>
        <style>{".hub-space__content{opacity:1!important;transform:none!important;pointer-events:auto!important}"}</style>
      </noscript>
      <SpaceIntro playIntro={withIntro}>
        <div className="hub-auth__layout">
          <section className="hub-auth__brand" aria-label="Hangap">
            <HangapLogo size={56} tone="light" src={BRAND_LOGO_SRC} />
            <p className="hub-auth__tagline">{BRAND_TAGLINE}</p>
            <p className="hub-auth__motto">{BRAND_MOTTO}</p>
            <ReplayIntroButton />
          </section>
          <section className="hub-auth__panel">
            <div className="hub-glow-card">
              <div className="hub-auth__card">
                <h1 className="hg-auth__title">{title}</h1>
                {intro ? <p className="hg-muted">{intro}</p> : null}
                {children}
              </div>
            </div>
          </section>
        </div>
        <footer className="hub-auth__footer">
          <p>Hangap · {BRAND_MOTTO}</p>
        </footer>
      </SpaceIntro>
    </main>
  );
}
