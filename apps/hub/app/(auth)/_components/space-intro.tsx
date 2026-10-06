"use client";
// Intro do login: o vídeo do sistema solar toca sozinho em tela cheia e, conforme avança, o login vai
// aparecendo. Clicar no vídeo (ou focar um campo) pula direto para o login. Depois da intro o vídeo fica
// em loop no fundo, transparente, com duas cópias que se misturam na emenda para o loop não "pular".
// A animação escreve variáveis CSS no elemento raiz a cada quadro (sem re-render do React).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import { Starfield } from "../../_components/starfield";

const VIDEO_WEBM = "/brand/intro-sistema-solar.webm";
const VIDEO_MP4 = "/brand/intro-sistema-solar.mp4";
const POSTER_SRC = "/brand/intro-sistema-solar.jpg";
const SEEN_KEY = "hub-intro-vista";
/** Segundos de mistura entre o fim de um loop e o começo do próximo */
const CROSSFADE = 1.2;
/** Fração do vídeo em que o login começa a aparecer */
const REVEAL_FROM = 0.4;
/** Duração do "pular": do ponto atual até o login completo */
const SKIP_SECONDS = 0.7;
/** Opacidade do vídeo no fundo, com o login em destaque */
const BACKDROP_LEVEL = 0.35;
/** Sem o vídeo começar nesse tempo (autoplay bloqueado, erro de rede), mostra o login */
const STALL_MS = 2500;

type Phase = "intro" | "login";

type Engine = {
  started: boolean;
  startedAt: number;
  last: number;
  active: 0 | 1;
  reveal: number;
  mode: "intro" | "loop";
  skipping: boolean;
  still: boolean;
};

const ReplayContext = createContext<(() => void) | null>(null);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function play(video: HTMLVideoElement | null) {
  if (!video) return;
  video.muted = true;
  video.play().catch(() => {});
}

export function SpaceIntro({ playIntro, children }: { playIntro: boolean; children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>(playIntro ? "intro" : "login");
  const rootRef = useRef<HTMLDivElement>(null);
  const videos = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null]);
  const engine = useRef<Engine>({
    started: false,
    startedAt: 0,
    last: 0,
    active: 0,
    reveal: playIntro ? 0 : 1,
    mode: playIntro ? "intro" : "loop",
    skipping: false,
    still: false,
  });

  const skip = useCallback(() => {
    const e = engine.current;
    if (e.mode === "intro") e.skipping = true;
    setPhase("login");
  }, []);

  const replay = useCallback(() => {
    const e = engine.current;
    if (e.still) return;
    const [a, b] = videos.current;
    if (b) {
      b.pause();
      b.currentTime = 0;
    }
    e.active = 0;
    e.reveal = 0;
    e.mode = "intro";
    e.skipping = false;
    e.startedAt = performance.now();
    if (a) {
      a.currentTime = 0;
      play(a);
    }
    setPhase("intro");
  }, []);

  useEffect(() => {
    const e = engine.current;
    let raf = 0;

    const tick = (now: number) => {
      const dt = e.last ? Math.min(0.1, (now - e.last) / 1000) : 0;
      e.last = now;

      if (!e.started) {
        e.started = true;
        e.startedAt = now;
        e.still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let seen = false;
        try {
          seen = sessionStorage.getItem(SEEN_KEY) === "1";
          sessionStorage.setItem(SEEN_KEY, "1");
        } catch {
          // sessionStorage indisponível (modo privado restrito): segue com a intro
        }
        if (e.mode === "intro" && (e.still || seen)) {
          e.mode = "loop";
          e.reveal = 1;
          setPhase("login");
        }
        if (!e.still) play(videos.current[0]);
      }

      const weights = [0, 0];
      const cur = videos.current[e.active];
      const next = videos.current[e.active === 0 ? 1 : 0];

      if (e.still || !cur) {
        weights[e.active] = 1;
        if (e.mode === "intro" && now - e.startedAt > STALL_MS) e.skipping = true;
      } else {
        const d = Number.isFinite(cur.duration) && cur.duration > 0 ? cur.duration : 10;
        const t = cur.currentTime;
        const end = d - CROSSFADE;

        if (e.mode === "intro" && t === 0 && now - e.startedAt > STALL_MS) e.skipping = true;
        if (e.mode === "intro") e.reveal = Math.max(e.reveal, clamp01((t - d * REVEAL_FROM) / (end - d * REVEAL_FROM)));

        weights[e.active] = 1;
        if ((e.mode === "loop" || e.skipping) && (t >= end || cur.ended)) {
          if (next && next.paused) {
            next.currentTime = 0;
            play(next);
          }
          const w = cur.ended ? 1 : clamp01((t - end) / CROSSFADE);
          if (w >= 1) {
            cur.pause();
            e.active = e.active === 0 ? 1 : 0;
            weights[e.active] = 1;
            weights[e.active === 0 ? 1 : 0] = 0;
          } else {
            weights[e.active] = 1 - w;
            weights[e.active === 0 ? 1 : 0] = w;
          }
        } else if (e.mode === "loop" && cur.paused && !cur.ended) {
          play(cur);
        }
      }

      if (e.mode === "intro") {
        if (e.skipping) e.reveal = Math.min(1, e.reveal + dt / SKIP_SECONDS);
        if (e.reveal >= 1) {
          e.mode = "loop";
          e.skipping = false;
          setPhase("login");
        }
      }

      const root = rootRef.current;
      if (root) {
        const eased = e.reveal * e.reveal * (3 - 2 * e.reveal);
        root.style.setProperty("--reveal", eased.toFixed(4));
        root.style.setProperty("--level", (1 - e.reveal * (1 - BACKDROP_LEVEL)).toFixed(4));
        root.style.setProperty("--video-a", weights[0].toFixed(4));
        root.style.setProperty("--video-b", weights[1].toFixed(4));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const initial = playIntro ? 0 : 1;
  const style = {
    "--reveal": initial,
    "--level": playIntro ? 1 : BACKDROP_LEVEL,
    "--video-a": 1,
    "--video-b": 0,
  } as CSSProperties;

  return (
    <ReplayContext.Provider value={playIntro ? replay : null}>
      <div ref={rootRef} className={`hub-space hub-space--${phase}`} style={style}>
        <div className="hub-space__backdrop" aria-hidden="true">
          <Starfield />
          <video
            ref={(el) => {
              videos.current[0] = el;
            }}
            className="hub-space__video hub-space__video--a"
            poster={POSTER_SRC}
            muted
            playsInline
            preload="auto"
            tabIndex={-1}
          >
            <source src={VIDEO_WEBM} type="video/webm" />
            <source src={VIDEO_MP4} type="video/mp4" />
          </video>
          <video
            ref={(el) => {
              videos.current[1] = el;
            }}
            className="hub-space__video hub-space__video--b"
            muted
            playsInline
            preload="auto"
            tabIndex={-1}
          >
            <source src={VIDEO_WEBM} type="video/webm" />
            <source src={VIDEO_MP4} type="video/mp4" />
          </video>
          <div className="hub-space__scrim" />
        </div>
        {phase === "intro" ? (
          <button
            type="button"
            className="hub-space__skip"
            aria-label="Pular introdução e ir para o login"
            onClick={skip}
          />
        ) : null}
        <div className="hub-space__content" onFocusCapture={phase === "intro" ? skip : undefined}>
          {children}
        </div>
      </div>
    </ReplayContext.Provider>
  );
}

/** "Ver intro de novo": só aparece onde a intro existe (login) */
export function ReplayIntroButton() {
  const replay = useContext(ReplayContext);
  if (!replay) return null;
  return (
    <button type="button" className="hub-pill" onClick={replay}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </svg>
      Ver intro de novo
    </button>
  );
}
