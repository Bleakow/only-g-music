"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { GlassModal } from "./GlassModal";
import { InfoIcon } from "@/components/icons";

/**
 * Botón «(i)» junto al título de una pantalla + modal con la explicación de qué
 * se hace ahí. El modal se abre SOLO en la primera visita (se recuerda por
 * `storageKey` en localStorage) para no estorbar; después queda a un clic del
 * botón. Reemplaza el párrafo de ayuda siempre visible. Lo comparten las
 * pantallas del panel admin y la consola de productor.
 */
export function IntroInfo({
  title,
  storageKey,
  children,
}: {
  /** Título del modal (normalmente el título de la pantalla). */
  title: string;
  /** Clave estable para recordar la primera visita (una por pantalla). */
  storageKey: string;
  /** Contenido de la ayuda (texto/nodo). */
  children: ReactNode;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  // Primera visita: abre el modal una vez y lo recuerda. Si localStorage no está
  // disponible (SSR / bloqueado), no auto-abre; el botón (i) sigue funcionando.
  useEffect(() => {
    try {
      const k = `ogm:intro:${storageKey}`;
      if (!localStorage.getItem(k)) {
        setOpen(true);
        localStorage.setItem(k, "1");
      }
    } catch {
      /* sin storage: sin auto-open */
    }
  }, [storageKey]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("common.whatIsThis")}
        title={t("common.whatIsThis")}
        className="text-silver-300 mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
      >
        <InfoIcon className="size-4" />
      </button>
      <GlassModal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="text-silver-200 text-sm leading-relaxed">{children}</div>
      </GlassModal>
    </>
  );
}
