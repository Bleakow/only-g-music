"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { glassSurface, GlassSheen } from "./glass";
import { CloseIcon } from "@/components/icons";

/**
 * Modal "Liquid Glass" (nuestra receta, ver ./glass). Va por portal a <body>
 * (el `fixed` se ancla al viewport, no a ancestros con transform/backdrop).
 *
 * Interacción: Esc y clic en el fondo cierran; bloquea el scroll del fondo.
 * Motion: `AnimatePresence` anima entrada/salida (fade del backdrop + fade/scale
 * del panel), respetando `prefers-reduced-motion` (queda solo el fade).
 * A11y: focus trap — al abrir enfoca el panel y el Tab queda atrapado dentro; al
 * cerrar restaura el foco al elemento que lo tenía antes.
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
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

  // `onClose` en una ref: si estuviera en las deps del efecto de abajo, un
  // `onClose` inline (nuevo en cada render del padre) re-ejecutaría el efecto en
  // cada tecleo y `panelRef.focus()` le robaría el foco al input (teclado que se
  // cierra tras un carácter). Con la ref, el efecto solo depende de `open`.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const prevFocus = document.activeElement as HTMLElement | null;
    // Enfoca el panel al abrir (no el primer input: evita que iOS abra el
    // teclado de golpe en modales de formulario).
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restaura el foco a quien lo tenía antes de abrir (el disparador).
      prevFocus?.focus?.();
    };
    // Solo `open`: el efecto se monta al abrir y se limpia al cerrar. `onClose`
    // va por ref (arriba) para no re-ejecutarlo en cada render.
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-80 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={`${glassSurface} w-full max-w-md rounded-3xl p-6 outline-none ${className ?? ""}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <GlassSheen />
            <div className="relative">
              <button
                type="button"
                onClick={onClose}
                aria-label={tCommon("close")}
                className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amethyst-300/70"
              >
                <CloseIcon className="size-5" />
              </button>
              {title && (
                <h2 className="mb-4 pr-12 font-narrow text-xl font-bold uppercase tracking-wide text-white">
                  {title}
                </h2>
              )}
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
