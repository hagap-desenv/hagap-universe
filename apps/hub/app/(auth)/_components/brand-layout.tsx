import { HangapLogo } from "@hagap/core/ui/hangap-logo";
import { BRAND_LOGO_SRC, BRAND_MOTTO, BRAND_TAGLINE } from "@/lib/brand";

// Telas de acesso do hub: painel da marca (azul-marinho com ondas de luz) + cartão do formulário.
export function BrandLayout({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <main id="conteudo" className="hub-auth">
      <section className="hub-auth__brand" aria-label="Hangap">
        <Waves />
        <div className="hub-auth__brand-content">
          <HangapLogo size={56} tone="light" src={BRAND_LOGO_SRC} />
          <p className="hub-auth__tagline">{BRAND_TAGLINE}</p>
          <p className="hub-auth__motto">{BRAND_MOTTO}</p>
        </div>
      </section>
      <section className="hub-auth__panel">
        <div className="hub-auth__card">
          <h1 className="hg-auth__title">{title}</h1>
          {intro ? <p className="hg-muted">{intro}</p> : null}
          {children}
        </div>
      </section>
    </main>
  );
}

// Ondas/curvas de luz decorativas (canto inferior direito)
function Waves() {
  return (
    <svg className="hub-auth__waves" viewBox="0 0 600 400" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="hub-wave" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38BDF8" stopOpacity="0" />
          <stop offset="0.6" stopColor="#38BDF8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#1E6BFF" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {[0, 18, 36, 54, 72].map((d) => (
        <path
          key={d}
          d={`M ${120 + d} 400 C ${260 + d} ${300 - d}, ${380 - d} ${330 - d}, 600 ${150 + d}`}
          fill="none"
          stroke="url(#hub-wave)"
          strokeWidth={d === 36 ? 3 : 1.5}
        />
      ))}
    </svg>
  );
}
