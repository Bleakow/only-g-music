"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { glassSurfaceSoft } from "@/components/ui/glass";

/**
 * Chip premium del perfil (§04). Reemplaza los `<span>` de borde plano (que se
 * leían como HTML sin estilar) por una píldora de cristal con punto de acento,
 * halo radial al pasar el cursor y micro-elevación.
 *
 * Vive compartido entre el perfil PÚBLICO y el EDITOR para que un chip se vea
 * igual en los dos lados; si diverge el estilo, diverge aquí una sola vez.
 */

const SIZES = {
  sm: "gap-1.5 px-3 py-1 text-[0.68rem]",
  md: "gap-2 px-4 py-2 text-xs",
} as const;

export type ProfileChipSize = keyof typeof SIZES;

export function ProfileChip({
  children,
  accent = "#a78bfa",
  icon,
  size = "md",
  onClick,
  onRemove,
  removeLabel,
  title,
  ariaLabel,
  className = "",
}: {
  children: ReactNode;
  /** Color del punto y del halo. Por defecto, amatista de marca. */
  accent?: string;
  /** Sustituye al punto de acento (p. ej. un icono de verificado). */
  icon?: ReactNode;
  size?: ProfileChipSize;
  onClick?: () => void;
  /** Si se pasa, añade la ✕ para quitar el chip (chips de género del editor). */
  onRemove?: () => void;
  removeLabel?: string;
  title?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const interactive = Boolean(onClick);

  const cls = `group ${glassSurfaceSoft} ${SIZES[size]} inline-flex items-center overflow-hidden rounded-full font-semibold tracking-[2px] text-white/85 uppercase transition-colors hover:text-white ${
    interactive ? "cursor-pointer" : ""
  } ${className}`;

  // Halo radial teñido con el acento: invisible en reposo, se enciende al hover.
  // Va como capa propia (no como box-shadow) para que el cristal siga leyéndose.
  const halo = (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style={{
        background: `radial-gradient(120% 140% at 20% 0%, ${accent}44, transparent 70%)`,
      }}
    />
  );

  const marker = icon ?? (
    <span
      aria-hidden="true"
      className="size-1.5 shrink-0 rounded-full transition-transform duration-300 group-hover:scale-125"
      style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }}
    />
  );

  const inner = (
    <>
      {halo}
      <span className="relative shrink-0 leading-none">{marker}</span>
      <span className="relative whitespace-nowrap">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={removeLabel}
          title={removeLabel}
          className="relative -mr-1 flex size-5 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/15 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="size-3"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </>
  );

  const motionProps = reduce
    ? {}
    : {
        whileHover: { y: -2 },
        whileTap: interactive ? { scale: 0.96 } : undefined,
        transition: { type: "spring" as const, stiffness: 420, damping: 26 },
      };

  if (interactive) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
        className={cls}
        {...motionProps}
      >
        {inner}
      </motion.button>
    );
  }

  return (
    <motion.span
      title={title}
      aria-label={ariaLabel}
      className={cls}
      {...motionProps}
    >
      {inner}
    </motion.span>
  );
}

/**
 * Campo con forma de chip para el EDITOR: mismo cristal y mismo halo que
 * `ProfileChip`, pero lo que hay dentro es editable (un input o un botón que
 * abre un selector). Así el editor y el perfil hablan el mismo idioma visual.
 */
export function ProfileChipField({
  accent = "#a78bfa",
  icon,
  label,
  children,
  className = "",
}: {
  accent?: string;
  icon?: ReactNode;
  /** Etiqueta corta encima del campo (qué se está editando). */
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <span className="mb-1.5 block text-[10px] font-semibold tracking-[2px] text-white/50 uppercase">
          {label}
        </span>
      )}
      <div
        className={`group ${glassSurfaceSoft} focus-within:ring-amethyst-300/70 relative inline-flex items-center gap-2 rounded-full px-3.5 py-2 transition-shadow`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
          style={{
            background: `radial-gradient(120% 140% at 20% 0%, ${accent}44, transparent 70%)`,
          }}
        />
        {icon && (
          <span
            className="relative shrink-0 text-white/60 transition-colors group-focus-within:text-white/90"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <span className="relative flex min-w-0 flex-1 items-center gap-1.5">
          {children}
        </span>
      </div>
    </div>
  );
}
