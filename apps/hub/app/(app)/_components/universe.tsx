"use client";
// Painel de apps como um sistema solar: o sol é a igreja ativa e cada app liberado é um planeta em órbita.
// As órbitas são elipses (plano visto em perspectiva): o planeta diminui quando vai para trás e passa atrás
// ou na frente do sol conforme a posição. O movimento é calculado a cada quadro e escrito direto no estilo
// (sem re-render), pausa com o mouse/foco sobre o sistema e fica parado com "reduzir movimento".
// Clicar num planeta mostra os detalhes; a faixa "Acesso rápido" traz os mesmos apps fixos para abrir direto.
// No celular só a faixa aparece.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AppGlyph, planetStyle } from "./app-glyph";

export type UniverseApp = { key: string; name: string; description: string; url: string | null };

/** Raio (px) e período (s) de cada órbita, de dentro para fora; phase = posição inicial (fração da volta) */
const ORBITS = [
  { radius: 190, period: 36, phase: 0.62 },
  { radius: 290, period: 58, phase: 0.08 },
  { radius: 390, period: 84, phase: 0.85 },
] as const;

/** Achatamento da elipse: cos(64°), o plano das órbitas inclinado */
const FLATTEN = 0.44;

type Orbit = { radius: number; period: number; phase: number };

function orbitFor(index: number): Orbit {
  const orbit = ORBITS[index % ORBITS.length];
  // Apps além do número de órbitas dividem a órbita, defasados meia volta
  const lap = Math.floor(index / ORBITS.length);
  return { ...orbit, phase: (orbit.phase + lap / 2) % 1 };
}

/** Posição do planeta no ângulo dado: elipse, escala pela profundidade e camada (atrás/na frente do sol) */
function placement(orbit: Orbit, turn: number) {
  const angle = turn * 2 * Math.PI;
  const depth = Math.sin(angle); // 1 = mais perto de quem olha (embaixo), -1 = mais longe (em cima)
  const x = orbit.radius * Math.cos(angle);
  const y = orbit.radius * FLATTEN * depth;
  const scale = 0.82 + 0.22 * ((depth + 1) / 2);
  return { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`, zIndex: depth > 0 ? 3 : 1 };
}

function ringStyle(radius: number): CSSProperties {
  return { width: radius * 2, height: radius * 2 * FLATTEN };
}

export function Universe({
  apps,
  tenantName,
  children,
}: {
  apps: readonly UniverseApp[];
  tenantName: string;
  /** Saudação (renderizada no servidor) no topo da coluna da esquerda */
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const stageRef = useRef<HTMLElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bodies = Array.from(stage.querySelectorAll<HTMLElement>("[data-orbit]"));
    let elapsed = 0;
    let last = 0;
    let raf = 0;
    const tick = (now: number) => {
      if (last && !paused.current) elapsed += Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const body of bodies) {
        const orbit = orbitFor(Number(body.dataset.orbit));
        const { transform, zIndex } = placement(orbit, orbit.phase + elapsed / orbit.period);
        body.style.transform = transform;
        body.style.zIndex = String(zIndex);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [apps.length]);

  const current = apps.find((app) => app.key === selected) ?? null;
  const ringCount = Math.min(ORBITS.length, Math.max(apps.length + 1, 2));
  const ghostIndex = apps.length < ORBITS.length ? apps.length : null;

  return (
    <div className="hub-home">
      <div className="hub-home__grid">
        <div className="hub-home__intro">
          {children}
          <div aria-live="polite">
            {apps.length === 0 ? (
              <div className="hub-panel" data-testid="no-apps">
                <h2>Nenhum app habilitado para esta igreja</h2>
                <p>Quando a plataforma liberar um app para a sua igreja e o seu papel, ele entra em órbita aqui.</p>
              </div>
            ) : current ? (
              <div className="hub-panel hub-panel--app" style={planetStyle(current.key)}>
                <div className="hub-panel__head">
                  <span className="hub-orb hub-orb--md">
                    <AppGlyph appKey={current.key} size={26} />
                  </span>
                  <div>
                    <h2>{current.name}</h2>
                    <p className="hg-muted">{current.description}</p>
                  </div>
                </div>
                <div className="hub-panel__actions">
                  {current.url ? (
                    <a className="hub-open" href={current.url}>
                      Abrir {current.name}
                      <ArrowIcon />
                    </a>
                  ) : (
                    <p className="hg-muted">Endereço do app ainda não configurado.</p>
                  )}
                  <button type="button" className="hub-pill" onClick={() => setSelected(null)}>
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <p className="hub-panel hub-panel--hint">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-20 12 12)" />
                </svg>
                Selecione um planeta para ver os detalhes do app.
              </p>
            )}
          </div>
        </div>

        <section
          ref={stageRef}
          className="hub-stage"
          aria-label="Sistema solar de apps"
          onMouseEnter={() => (paused.current = true)}
          onMouseLeave={() => (paused.current = false)}
          onFocus={() => (paused.current = true)}
          onBlur={() => (paused.current = false)}
        >
          <div className="hub-stage__plane">
            {ORBITS.slice(0, ringCount).map((orbit, i) => (
              <div
                key={orbit.radius}
                className={`hub-ring${i === ghostIndex ? " hub-ring--ghost" : ""}`}
                style={{ ...ringStyle(orbit.radius), ...(apps[i] ? planetStyle(apps[i].key) : {}) }}
                aria-hidden="true"
              />
            ))}
            <div className="hub-sun-halo" aria-hidden="true" />

            <div className="hub-sun">
              <span className="hub-sun__corona" aria-hidden="true" />
              <span className="hub-sun__corona hub-sun__corona--late" aria-hidden="true" />
              <span className="hub-sun__body">
                <span className="hub-sun__kicker">Sua igreja</span>
                <span className="hub-sun__name">{tenantName}</span>
              </span>
            </div>

            {apps.map((app, i) => (
              <div key={app.key} className="hub-orbit" data-orbit={i} style={placement(orbitFor(i), orbitFor(i).phase)}>
                <button
                  type="button"
                  className="hub-planet"
                  style={planetStyle(app.key)}
                  aria-pressed={selected === app.key}
                  data-testid={`app-planet-${app.key}`}
                  onClick={() => setSelected(selected === app.key ? null : app.key)}
                >
                  <AppGlyph appKey={app.key} size={34} />
                  <span className="hub-planet__label">{app.name}</span>
                </button>
              </div>
            ))}

            {ghostIndex !== null ? (
              <div
                className="hub-orbit hub-orbit--ghost"
                data-orbit={ghostIndex}
                style={placement(orbitFor(ghostIndex), orbitFor(ghostIndex).phase)}
                aria-hidden="true"
              >
                <div className="hub-planet hub-planet--ghost">
                  <PlusIcon />
                  <span className="hub-planet__label">Em breve</span>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <nav className="hub-dock" aria-labelledby="hub-dock-title">
        <div className="hub-dock__head">
          <h2 id="hub-dock-title">Acesso rápido</h2>
          <p className="hg-muted">Seus apps fixos, sempre à mão</p>
        </div>
        <ul className="hub-dock__list">
          {apps.map((app) => (
            <li key={app.key}>
              {app.url ? (
                <a
                  className="hub-tile"
                  href={app.url}
                  style={planetStyle(app.key)}
                  aria-label={`Abrir ${app.name}`}
                  aria-describedby={`app-desc-${app.key}`}
                  data-testid={`app-card-${app.key}`}
                  data-selected={selected === app.key || undefined}
                >
                  <TileBody app={app} />
                  <ArrowIcon />
                </a>
              ) : (
                <div className="hub-tile hub-tile--off" style={planetStyle(app.key)} data-testid={`app-card-${app.key}`}>
                  <TileBody app={app} note="Endereço do app ainda não configurado." />
                </div>
              )}
            </li>
          ))}
          <li>
            <div className="hub-tile hub-tile--ghost">
              <span className="hub-orb hub-orb--ghost" aria-hidden="true">
                <PlusIcon />
              </span>
              <span className="hub-tile__text">
                <span className="hub-tile__name">Em breve</span>
                <span className="hub-tile__desc">Novos apps entram aqui</span>
              </span>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function TileBody({ app, note }: { app: UniverseApp; note?: string }) {
  return (
    <>
      <span className="hub-orb" aria-hidden="true">
        <AppGlyph appKey={app.key} size={24} />
      </span>
      <span className="hub-tile__text">
        <span className="hub-tile__name">{app.name}</span>
        <span className="hub-tile__desc" id={`app-desc-${app.key}`}>
          {note ?? app.description}
        </span>
      </span>
    </>
  );
}

function ArrowIcon() {
  return (
    <svg className="hub-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
