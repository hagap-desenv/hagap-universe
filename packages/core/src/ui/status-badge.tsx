// Indicadores de estado: cor + ícone + texto (cor nunca é o único indicador — WCAG 1.4.1).
export type Tone = "bem" | "atencao" | "critico" | "neutro";

const ICONS: Record<Tone, string> = {
  bem: "✓",
  atencao: "!",
  critico: "✕",
  neutro: "•",
};

export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`hg-badge hg-badge--${tone}`}>
      <span className="hg-badge__icon" aria-hidden="true">
        {ICONS[tone]}
      </span>
      {label}
    </span>
  );
}

export type CareStatus = "bem" | "atencao" | "critico";

const CARE_LABELS: Record<CareStatus, string> = {
  bem: "Bem",
  atencao: "Atenção",
  critico: "Crítico",
};

export function CareStatusBadge({ status }: { status: CareStatus }) {
  return <StatusBadge tone={status} label={CARE_LABELS[status]} />;
}
