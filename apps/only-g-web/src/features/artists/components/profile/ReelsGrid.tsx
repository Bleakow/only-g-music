"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import type { FeaturedMedia } from "@only-g/shared-types/artist-profile";
import { ArrowLeftIcon, CloseIcon, PlayIcon } from "@/components/icons";
import {
  REEL_ANCHO_MAX,
  columnasDeReels,
} from "../../lib/reels-layout";
import { FeaturedVideoPlayer } from "./FeaturedVideoPlayer";

/**
 * REELS en escritorio: cuadrícula de miniaturas verticales; la que se pulsa se
 * abre a pantalla completa.
 *
 * Solo se monta en pantallas anchas (`hidden lg:block` desde el llamador). En el
 * móvil un reel a ancho completo es su formato nativo y se ve mejor que
 * cualquier cosa que hiciéramos aquí, así que ahí sigue el reproductor de
 * siempre: esta pieza existe para arreglar el escritorio, no para sustituirlo.
 *
 * La fila va CENTRADA y con las piezas acotadas de ancho (`REEL_ANCHO_MAX`).
 * Sin eso, un solo reel se estiraba a lo ancho del monitor y dos parecían una
 * rejilla de cuatro a la que le faltaban dos.
 */
export function ReelsGrid({
  items,
  name,
  accent,
}: {
  items: FeaturedMedia[];
  name: string;
  accent?: string;
}) {
  const t = useTranslations("artistProfile");
  const [abierto, setAbierto] = useState<number | null>(null);
  if (items.length === 0) return null;

  const cols = columnasDeReels(items.length);

  return (
    <>
      <div
        className="mx-auto grid w-fit gap-4"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, ${REEL_ANCHO_MAX}px))`,
        }}
      >
        {items.map((m, i) => (
          <button
            key={`${m.url}-${i}`}
            type="button"
            onClick={() => setAbierto(i)}
            aria-label={t("playReel", { n: i + 1 })}
            className="group bg-ink-soft relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 transition hover:border-white/30"
          >
            {/* `#t=0.1` fuerza al navegador a pintar un FOTOGRAMA como portada:
                sin el fragmento, `preload="metadata"` deja el recuadro en negro
                y la cuadrícula parece rota. No tenemos posters generados. */}
            <video
              src={`${m.url}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              tabIndex={-1}
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-12 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/30 backdrop-blur-sm transition group-hover:scale-110">
                <PlayIcon className="size-5 translate-x-0.5" />
              </span>
            </span>
            {m.title && (
              <span className="absolute inset-x-0 bottom-0 truncate p-3 text-left text-sm font-semibold text-white">
                {m.title}
              </span>
            )}
          </button>
        ))}
      </div>

      {abierto !== null && (
        <ReelViewer
          items={items}
          index={abierto}
          name={name}
          accent={accent}
          onClose={() => setAbierto(null)}
          onNavigate={setAbierto}
        />
      )}
    </>
  );
}

/**
 * Visor del reel a pantalla completa. Mismas costumbres que `PhotoViewer`
 * (portal a <body> para que el `fixed` se ancle al viewport y no lo atrape un
 * ancestro con transform/backdrop-filter, Escape y flechas, scroll del fondo
 * bloqueado, y aviso al header para que se aparte).
 *
 * La caja se mide contra el VIEWPORT, no contra el clip: un vertical entra
 * entero de alto y uno horizontal entra entero de ancho, sin recortes.
 */
function ReelViewer({
  items,
  index,
  name,
  accent,
  onClose,
  onNavigate,
}: {
  items: FeaturedMedia[];
  index: number;
  name: string;
  accent?: string;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const t = useTranslations("artistProfile");
  const tCommon = useTranslations("common");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const go = useCallback(
    (dir: number) => {
      if (items.length < 2) return;
      onNavigate((index + dir + items.length) % items.length);
    },
    [index, items.length, onNavigate],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("ogm:viewer", { detail: true }));
    return () => {
      window.dispatchEvent(new CustomEvent("ogm:viewer", { detail: false }));
    };
  }, []);

  if (!mounted) return null;
  const actual = items[index];
  const varios = items.length > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={tCommon("close")}
        className="absolute top-4 right-4 z-10 flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
      >
        <CloseIcon className="size-6" />
      </button>

      {/* `min()` contra las DOS dimensiones: el alto manda en un vertical y el
          ancho en uno horizontal, así que ninguno se sale ni se recorta. */}
      <div className="h-[82svh] w-[min(92vw,calc(82svh*9/16))]">
        <FeaturedVideoPlayer
          key={actual.url}
          variant="viewer"
          src={actual.url}
          muted={!actual.withAudio}
          name={actual.title || name}
          accent={accent}
        />
      </div>

      {varios && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={tCommon("previous")}
            className="absolute top-1/2 left-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeftIcon className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={tCommon("next")}
            className="absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeftIcon className="size-6 rotate-180" />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 backdrop-blur">
            {t("reelN", { n: index + 1, total: items.length })}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
