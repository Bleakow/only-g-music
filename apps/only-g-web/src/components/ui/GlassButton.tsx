"use client";

import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import { glassSurface, GlassSheen } from "./glass";

/**
 * Botón "Liquid Glass" (nuestra receta, ver ./glass). Renderiza un <Link> si
 * recibe `href`, o un <button> con `onClick`.
 */
export function GlassButton({
  href,
  onClick,
  children,
  className,
  disabled,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const cls = `group ${glassSurface} inline-flex min-h-11 items-center gap-2 self-start rounded-full px-4 py-2 text-sm uppercase tracking-[3px] text-white/90 transition hover:scale-105 hover:text-white active:scale-95 ${
    disabled ? "pointer-events-none opacity-40" : ""
  } ${className ?? ""}`;

  const inner = (
    <>
      <GlassSheen />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}
