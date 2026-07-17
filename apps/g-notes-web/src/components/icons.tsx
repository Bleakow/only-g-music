// Iconos locales de G Notes (SVG, sin emojis). Trazo consistente.

/** Compartir — estilo iOS: flecha hacia arriba saliendo de una caja. */
export function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M8 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2" />
    </svg>
  );
}
