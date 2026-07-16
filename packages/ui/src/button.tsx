"use client";

import type { ButtonHTMLAttributes } from "react";
import { SpinnerIcon } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "icon";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold uppercase tracking-[2px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amethyst-300/70 disabled:cursor-not-allowed disabled:opacity-60";

const SIZES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-xs",
  md: "px-6 py-3 text-sm",
  icon: "size-9",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-linear-to-r from-silver-100 to-amethyst-300 text-ink hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]",
  secondary:
    "border border-silver-300/40 text-silver-100 hover:border-silver-100 hover:bg-white/5",
  outline:
    "border border-amethyst-400/60 text-amethyst-200 hover:border-amethyst-300 hover:bg-amethyst-500/10 hover:text-white",
  danger:
    "border border-red-500/40 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/20 hover:text-white",
};

/**
 * Botón reutilizable del ecosistema Only G (only-g-web + g-notes-web). Variantes
 * de estilo + estado `loading` con spinner. `type="button"` por defecto.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <SpinnerIcon className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
