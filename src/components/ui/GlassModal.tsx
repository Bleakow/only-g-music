"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { glassSurface, GlassSheen } from "./glass";
import { CloseIcon } from "@/components/icons";

/**
 * Modal "Liquid Glass" (nuestra receta, ver ./glass). Va por portal a <body>
 * (el `fixed` se ancla al viewport, no a ancestros con transform/backdrop). Esc
 * y clic en el fondo para cerrar; bloquea el scroll del fondo mientras abre.
 */
export function GlassModal({
  open,
  onClose,
  children,
  title,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  const tCommon = useTranslations("common");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${glassSurface} w-full max-w-md rounded-3xl p-6 ${className ?? ""}`}
      >
        <GlassSheen />
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="absolute right-0 top-0 flex size-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <CloseIcon className="size-5" />
          </button>
          {title && (
            <h2 className="mb-4 pr-10 font-narrow text-xl font-bold uppercase tracking-wide text-white">
              {title}
            </h2>
          )}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
