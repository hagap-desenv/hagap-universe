// Marca Hangap recriada em SVG (fiel ao estilo da apresentação, não idêntica): "H" em degradê
// turquesa → azul → violeta com ponto turquesa, wordmark arredondado. Para usar o arquivo oficial,
// passe `src` (ex.: "/brand/hangap-logo.svg" em public/brand/) e o SVG recriado deixa de ser usado.
import { useId } from "react";

export function HangapLogo({
  size = 48,
  wordmark = true,
  tone = "light",
  src,
  className,
}: {
  size?: number;
  wordmark?: boolean;
  /** light = wordmark branco (fundo escuro); dark = wordmark azul-marinho (fundo claro) */
  tone?: "light" | "dark";
  src?: string | null;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const width = wordmark ? size * 3.6 : size;

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- arquivo oficial da marca (SVG/PNG) em public/brand
    return <img src={src} alt="Hangap" height={size} className={className} />;
  }

  return (
    <svg
      role="img"
      aria-label="Hangap"
      width={width}
      height={size}
      viewBox={wordmark ? "0 0 216 60" : "0 0 60 60"}
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#19E3C7" />
          <stop offset="0.55" stopColor="#1E88FF" />
          <stop offset="1" stopColor="#7C5CFF" />
        </linearGradient>
      </defs>
      <g aria-hidden="true">
        {/* Hastes do H, arredondadas */}
        <rect x="6" y="10" width="11" height="44" rx="5.5" fill={`url(#${id}-g)`} />
        <rect x="35" y="16" width="11" height="38" rx="5.5" fill={`url(#${id}-g)`} />
        {/* Travessa em curva (movimento/conexão) */}
        <path
          d="M11 38 C 20 26, 30 26, 41 30"
          fill="none"
          stroke={`url(#${id}-g)`}
          strokeWidth="9"
          strokeLinecap="round"
        />
        {/* Ponto turquesa */}
        <circle cx="47" cy="8" r="6" fill="#19E3C7" />
      </g>
      {wordmark ? (
        <text
          x="64"
          y="43"
          aria-hidden="true"
          fill={tone === "light" ? "#FFFFFF" : "#0B2A5B"}
          fontFamily="'Nunito', 'Varela Round', 'Quicksand', system-ui, sans-serif"
          fontSize="34"
          fontWeight="700"
          letterSpacing="0.5"
        >
          Hangap
        </text>
      ) : null}
    </svg>
  );
}
