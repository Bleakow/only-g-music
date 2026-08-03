"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { glassSurfaceMenu, glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import { CheckIcon, EditIcon } from "@/components/icons";

/**
 * Selector del color de acento del perfil, con el lenguaje Liquid Glass de la
 * casa en vez del `<input type="color">` pelado del sistema operativo (que se
 * veía como una caja gris ajena a la marca y abría el diálogo nativo).
 *
 * Paleta curada + escotilla al selector nativo para quien quiera un tono exacto.
 */

/** Tonos que combinan con el fondo oscuro y el amatista de marca. */
const PRESETS = [
  "#c4a5ff", // amatista claro
  "#8b5cf6", // amatista (por defecto)
  "#7c3aed", // amatista profundo
  "#e9e9f0", // plata
  "#38bdf8", // cian
  "#34d399", // verde
  "#fbbf24", // ámbar
  "#fb7185", // coral
  "#f472b6", // magenta
  "#f97316", // naranja
] as const;

export function AccentColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const t = useTranslations("profileBuilder.accent");
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  // Cierra al hacer clic fuera o con Esc (el popover no es modal).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("open")}
        title={t("open")}
        className={`group ${glassSurfaceSoft} inline-flex min-h-11 items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 transition hover:scale-[1.03] active:scale-95`}
      >
        <GlassSheen />
        {/* Muestra del color con su propio halo: el color ES el contenido. */}
        <span
          className="relative size-8 shrink-0 rounded-full ring-1 ring-white/40 ring-inset"
          style={{ backgroundColor: value, boxShadow: `0 0 14px ${value}80` }}
        />
        <span className="relative text-[10px] font-semibold tracking-[2px] text-white/70 uppercase transition-colors group-hover:text-white">
          {t("label")}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t("label")}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className={`${glassSurfaceMenu} absolute bottom-full left-0 z-50 mb-2 w-64 rounded-2xl p-3`}
          >
            <GlassSheen />
            <div className="relative">
              <p className="mb-2.5 text-[10px] font-semibold tracking-[2px] text-white/55 uppercase">
                {t("pick")}
              </p>
              <div className="grid grid-cols-5 gap-2">
                {PRESETS.map((hex) => {
                  const on = hex.toLowerCase() === value.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        onChange(hex);
                        setOpen(false);
                      }}
                      aria-label={hex}
                      aria-pressed={on}
                      title={hex}
                      className="grid size-9 place-items-center rounded-full ring-1 ring-white/25 transition ring-inset hover:scale-110 active:scale-95"
                      style={{
                        backgroundColor: hex,
                        boxShadow: on ? `0 0 16px ${hex}` : undefined,
                      }}
                    >
                      {on && (
                        <CheckIcon className="size-4 text-black/70 drop-shadow" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Escotilla al selector nativo: el input va oculto y lo dispara
                  este botón, para no romper el lenguaje visual con la caja del SO. */}
              <button
                type="button"
                onClick={() => nativeRef.current?.click()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 px-3 py-2.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white"
              >
                <EditIcon className="size-3.5" />
                {t("custom")}
                <span
                  aria-hidden="true"
                  className="size-3.5 rounded-full ring-1 ring-white/40 ring-inset"
                  style={{ backgroundColor: value }}
                />
              </button>
              <input
                ref={nativeRef}
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={t("custom")}
                className="sr-only"
                tabIndex={-1}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
