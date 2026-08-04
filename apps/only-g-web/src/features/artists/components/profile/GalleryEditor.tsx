"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  areaDeRanura,
  layoutEfectivo,
  layoutsParaFotos,
  type GalleryLayoutId,
} from "@only-g/shared-types/gallery-layout";
import type { GalleryItem } from "@only-g/shared-types/artist-profile";
import {
  CheckIcon,
  CloseIcon,
  ImageIcon,
  MoveIcon,
  PlusIcon,
  SpinnerIcon,
} from "@/components/icons";
import { UploadButton } from "./UploadButton";
import { GalleryLayoutThumb } from "./GalleryMosaic";

/**
 * Editor de la GALERÍA: elegir composición, subir fotos y colocarlas.
 *
 * Dos decisiones de UX que vienen de lo que fallaba antes:
 *
 * 1. **Plantillas en vez de tamaños sueltos.** El artista ya no decide "esta
 *    foto es ancha": elige un mosaico de los que existen para el número de fotos
 *    que tiene. Así no hay huecos, no hay desbordes y el resultado es el mismo en
 *    su móvil y en el escritorio de quien lo visita.
 *
 * 2. **Tocar para intercambiar, sin arrastrar.** Arrastrar dentro de una página
 *    que también hace scroll es una pelea perdida en móvil (hay que mantener
 *    pulsado, el scroll se cuela, la foto se escapa). Aquí se toca "mover" en una
 *    foto y luego la ranura de destino: las dos se cambian de sitio. Es la misma
 *    interacción con dedo, ratón y teclado —son botones—, y hace exactamente lo
 *    que se pide: la que estaba ahí se va al hueco que deja la que mueves.
 */
export function GalleryEditor({
  items,
  layout,
  limit,
  uploading,
  onLayout,
  onSwap,
  onRemove,
  onFiles,
}: {
  items: GalleryItem[];
  layout: GalleryLayoutId | null | undefined;
  limit: number;
  uploading: boolean;
  onLayout: (id: GalleryLayoutId) => void;
  onSwap: (a: number, b: number) => void;
  onRemove: (url: string) => void;
  onFiles: (files: File[]) => void;
}) {
  const t = useTranslations("profileBuilder.gallery");
  /** Ranura en modo "elige destino" (null = nadie moviéndose). */
  const [moviendo, setMoviendo] = useState<number | null>(null);

  const efectivo = layoutEfectivo(layout, items.length);
  const opciones = layoutsParaFotos(items.length);

  // Si cambia el nº de fotos, la ranura marcada puede dejar de existir.
  useEffect(() => {
    setMoviendo((m) => (m != null && m >= items.length ? null : m));
  }, [items.length]);

  function elegirRanura(i: number) {
    if (moviendo == null) {
      setMoviendo(i);
      return;
    }
    if (moviendo !== i) onSwap(moviendo, i);
    setMoviendo(null);
  }

  const puedeSubir = items.length < limit;

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de composición. Solo aparece si hay entre qué elegir para el
          número de fotos actual: un selector de una sola opción es decoración. */}
      {opciones.length > 1 && (
        <div>
          <p className="text-silver-400 mb-2 text-xs tracking-[2px] uppercase">
            {t("layoutTitle")}
          </p>
          <div className="flex flex-wrap gap-2">
            {opciones.map((op) => {
              const on = op.id === efectivo;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => onLayout(op.id)}
                  aria-pressed={on}
                  title={t(`layouts.${op.id}`)}
                  className={`flex w-24 flex-col items-center gap-1.5 rounded-xl p-2 ring-1 transition ring-inset ${
                    on
                      ? "bg-amethyst-500/20 text-amethyst-100 ring-amethyst-300/60"
                      : "text-silver-300 bg-white/[0.04] ring-white/15 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <GalleryLayoutThumb layout={op.id} slots={op.slots} />
                  <span className="text-[0.65rem] font-semibold tracking-wide uppercase">
                    {t(`layouts.${op.id}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mosaico editable */}
      {items.length === 0 ? (
        <UploadButton
          accept="image/*"
          multiple
          onFiles={onFiles}
          disabled={uploading}
          className="hover:border-amethyst-300 flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 text-white/60 transition hover:text-white"
        >
          {uploading ? (
            <SpinnerIcon className="size-6 animate-spin" />
          ) : (
            <ImageIcon className="size-7" />
          )}
          <span className="text-sm">{t("empty")}</span>
        </UploadButton>
      ) : (
        <div className="og-gal-wrap">
          <div className="og-gal" data-layout={efectivo ?? undefined}>
            {items.map((item, i) => {
              const esOrigen = moviendo === i;
              const esDestino = moviendo != null && !esOrigen;
              return (
                <div
                  key={item.url}
                  style={{ gridArea: areaDeRanura(i) }}
                  className={`group relative overflow-hidden rounded-xl border bg-neutral-950 transition ${
                    esOrigen
                      ? "border-amethyst-300 ring-amethyst-300 ring-2"
                      : "border-white/10"
                  }`}
                >
                  <Image
                    src={item.url}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-cover"
                  />

                  {/* Con una foto "levantada", TODA la celda destino es el botón:
                      apuntar a un iconito de 32px en una miniatura es pedir
                      puntería que en un móvil no se tiene. */}
                  {esDestino ? (
                    <button
                      type="button"
                      onClick={() => elegirRanura(i)}
                      className="bg-amethyst-500/25 text-amethyst-50 ring-amethyst-300/70 absolute inset-0 flex items-center justify-center gap-1.5 text-xs font-semibold tracking-wide uppercase ring-2 backdrop-blur-[2px] ring-inset"
                    >
                      <CheckIcon className="size-4" />
                      {t("swapHere")}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => elegirRanura(i)}
                        aria-label={
                          esOrigen ? t("cancelMove") : t("moveAria", { n: i + 1 })
                        }
                        title={esOrigen ? t("cancelMove") : t("move")}
                        className={`absolute bottom-2 left-2 flex size-8 items-center justify-center rounded-full backdrop-blur-sm transition ${
                          esOrigen
                            ? "bg-amethyst-400 text-black"
                            : "bg-black/55 text-white hover:bg-black/75"
                        }`}
                      >
                        {esOrigen ? (
                          <CloseIcon className="size-4" />
                        ) : (
                          <MoveIcon className="size-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemove(item.url)}
                        aria-label={t("removeAria", { n: i + 1 })}
                        title={t("remove")}
                        className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-red-500/70"
                      >
                        <CloseIcon className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Añadir va FUERA del mosaico: las ranuras son exactamente las fotos que
          compone la plantilla, así que una celda "+" dejaría un hueco de mentira. */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {puedeSubir && (
            <UploadButton
              accept="image/*"
              multiple
              glass
              onFiles={onFiles}
              disabled={uploading}
            >
              {uploading ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <PlusIcon className="size-4" />
              )}
              {t("add")}
            </UploadButton>
          )}
          <p className="text-silver-500 text-xs">
            {puedeSubir
              ? t("counter", { count: items.length, limit })
              : t("full", { limit })}
          </p>
        </div>
      )}

      <p className="text-silver-500 text-xs">
        {moviendo != null ? t("hintMoving") : t("hint")}
      </p>
    </div>
  );
}
