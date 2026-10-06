// Visual de cada app no sistema solar: cores do planeta e ícone (decorativo: o nome do app vem em texto).
import type { CSSProperties } from "react";

type Palette = { light: string; base: string; dark: string; ink: string; glow: string };

const PALETTES: Record<string, Palette> = {
  disparador: { light: "#E4FFF9", base: "#19E3C7", dark: "#0B7F75", ink: "#04241F", glow: "rgb(25 227 199 / 50%)" },
  pai: { light: "#FFF0E6", base: "#FF8A5C", dark: "#B04A22", ink: "#2E0F02", glow: "rgb(255 138 92 / 50%)" },
};

const FALLBACK: Palette = { light: "#EFE9FF", base: "#9C84FF", dark: "#5B3FD6", ink: "#140A3A", glow: "rgb(156 132 255 / 50%)" };

/** Variáveis CSS do planeta (cores) para o app */
export function planetStyle(appKey: string): CSSProperties {
  const p = PALETTES[appKey] ?? FALLBACK;
  return {
    "--planet-light": p.light,
    "--planet-base": p.base,
    "--planet-dark": p.dark,
    "--planet-ink": p.ink,
    "--planet-glow": p.glow,
  } as CSSProperties;
}

export function AppGlyph({ appKey, size = 32 }: { appKey: string; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      {appKey === "disparador" ? (
        // Balão de mensagem
        <path
          d="M6 7h20a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H14l-6 5v-5H6a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      ) : appKey === "pai" ? (
        // Coração (cuidado)
        <path
          d="M16 27s-10-6.2-10-13a5.5 5.5 0 0 1 10-3.2A5.5 5.5 0 0 1 26 14c0 6.8-10 13-10 13z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      ) : (
        <rect x="6" y="6" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      )}
    </svg>
  );
}
