"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { glassSurfaceSoft, GlassSheen } from "./glass";

/**
 * Botón de icono "Liquid Glass" con micro-interacción SUTIL (motion): al pasar el
 * cursor se eleva y crece un pelín; al pulsar, se hunde. Superficie de cristal
 * (`glassSurfaceSoft` + `GlassSheen`) para leerse como vidrio incluso sobre fondo
 * oscuro, área táctil de 44px y foco visible amatista.
 *
 * El icono va como `children`; los badges/contadores también (se posicionan
 * `absolute` contra el botón — el span interior llena los 44px y es `relative`).
 * Respeta `prefers-reduced-motion` (sin scale/lift, solo color).
 */
export function IconButton({
  children,
  onClick,
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
  "aria-haspopup": ariaHaspopup,
  active = false,
  disabled = false,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  "aria-label": string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: boolean | "menu" | "listbox" | "dialog" | "grid" | "tree";
  active?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHaspopup}
      whileHover={reduce || disabled ? undefined : { scale: 1.06, y: -2 }}
      whileTap={reduce || disabled ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className={`${glassSurfaceSoft} group flex size-11 items-center justify-center rounded-full text-silver-100 transition-colors hover:text-white hover:ring-amethyst-300/40 focus-visible:ring-amethyst-300/70 focus-visible:outline-none disabled:opacity-40 ${active ? "text-white ring-amethyst-300/50" : ""} ${className}`}
    >
      <GlassSheen />
      <span className="relative flex size-full items-center justify-center">
        {children}
      </span>
    </motion.button>
  );
}
