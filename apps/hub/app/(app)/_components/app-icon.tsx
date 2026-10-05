// Ícones dos apps (decorativos: o nome do app está no título do card)
export function AppIcon({ appKey }: { appKey: string }) {
  return (
    <span className="hub-card__icon" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="32" height="32">
        {appKey === "disparador" ? (
          // Balão de mensagem
          <path
            d="M6 7h20a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H14l-6 5v-5H6a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        ) : appKey === "pai" ? (
          // Mãos que acolhem (coração)
          <path
            d="M16 27s-10-6.2-10-13a5.5 5.5 0 0 1 10-3.2A5.5 5.5 0 0 1 26 14c0 6.8-10 13-10 13z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        ) : (
          <rect x="6" y="6" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="2.2" />
        )}
      </svg>
    </span>
  );
}
