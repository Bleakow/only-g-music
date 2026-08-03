import type { ButtonHTMLAttributes } from "react";

/**
 * Icono "pelado" del dock: SIN círculo propio (vive dentro de la cápsula glass
 * grande, que es la que aporta el cristal). Hover llamativo: halo amatista + leve
 * escala. Para campana / chat / G-Note. El avatar, en cambio, sí lleva su círculo.
 */
export function DockIconButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`group text-silver-200 hover:bg-amethyst-500/20 focus-visible:ring-amethyst-300 relative flex size-11 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 hover:text-white hover:shadow-[0_0_16px_rgba(139,92,246,0.45)] focus-visible:ring-2 focus-visible:outline-none ${className}`}
    >
      {children}
    </button>
  );
}
