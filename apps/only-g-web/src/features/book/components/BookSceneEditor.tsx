"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { areaDeRanura, intercambiar } from "@only-g/shared-types/gallery-layout";
import {
  BOOK_ENCABEZADO_MAX,
  BOOK_ETIQUETA_MAX,
  BOOK_META_MAX,
  BOOK_NOTA_MAX,
  BOOK_TITULO_MAX,
  MEDIDAS_ELEGIBLES,
  META_ESQUINAS,
  escenaDef,
  esFotoDePortada,
  medidaDeEscena,
  piezasQueFaltan,
  rolDePiezaApertura,
  videosDeEscena,
  type EscenaBook,
  type MedidaEscena,
  type PiezaBook,
} from "@only-g/shared-types/book";
import {
  CheckIcon,
  CloseIcon,
  MoveIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/components/icons";
import { UploadButton } from "@/features/artists/components/profile/UploadButton";

/**
 * Una ESCENA en el editor: su composición real, sus ranuras y sus textos.
 *
 * Reordenar piezas es TOCAR-TOCAR, no arrastrar — la misma decisión que el
 * editor de galería, y por el mismo motivo: arrastrar dentro de una página que
 * también hace scroll es una pelea perdida en el móvil, y con botones funciona
 * igual con dedo, ratón y teclado. `intercambiar` se reutiliza tal cual.
 */
export function BookSceneEditor({
  escena,
  puedeSubir,
  subiendo,
  onChange,
  onFiles,
}: {
  escena: EscenaBook;
  /** Lo decide el book entero (tope global de piezas), no solo esta escena. */
  puedeSubir: boolean;
  subiendo: boolean;
  onChange: (e: EscenaBook) => void;
  onFiles: (files: File[]) => void;
}) {
  const t = useTranslations("bookEditor");
  const [moviendo, setMoviendo] = useState<number | null>(null);

  const def = escenaDef(escena.tipo);
  if (!def) return null;

  /**
   * Qué es cada ranura de la APERTURA. Cuatro huecos idénticos y un "sube tus
   * fotos" no le cuentan a nadie que la primera va a pantalla completa, dos
   * suben en diagonal y la última se desintegra. Solo la apertura lo necesita:
   * en las demás escenas todas las ranuras hacen lo mismo.
   */
  const rol = (i: number) =>
    escena.tipo === "portada" ? rolDePiezaApertura(i) : undefined;
  const etiquetaRol = (i: number) => {
    const r = rol(i);
    return r ? t(`rolApertura.${r}`) : null;
  };

  const set = (parcial: Partial<EscenaBook>) => onChange({ ...escena, ...parcial });
  const setPieza = (i: number, parcial: Partial<PiezaBook>) =>
    set({
      piezas: escena.piezas.map((p, j) => (j === i ? { ...p, ...parcial } : p)),
    });

  function elegirRanura(i: number) {
    if (moviendo === null) return setMoviendo(i);
    if (moviendo !== i) set({ piezas: intercambiar(escena.piezas, moviendo, i) });
    setMoviendo(null);
  }

  // Ranuras vacías hasta el máximo de la composición: hay que VER los huecos que
  // faltan por llenar, no adivinar cuántas fotos pide la escena.
  const huecos = Math.max(0, def.max - escena.piezas.length);
  // Cuántas faltan para la siguiente cuenta VÁLIDA, no para el mínimo. Con
  // `def.min` bastaba hasta que apareció el pliego: con tres fotos ya pasó del
  // mínimo, así que la resta daba cero y el aviso no salía — pero con tres no se
  // publica, y la modelo se quedaba mirando un botón apagado sin explicación.
  const faltan = piezasQueFaltan(escena);

  return (
    <div className="og-book-editor flex flex-col gap-4">
      {/* Sin encabezado donde la escena no lo tiene: un campo que se guarda y
          no se pinta es la peor clase de campo. */}
      {!def.sinEncabezado && (
      <input
        value={escena.encabezado ?? ""}
        onChange={(e) => set({ encabezado: e.target.value })}
        maxLength={BOOK_ENCABEZADO_MAX}
        placeholder={t(`encabezadoPlaceholder.${escena.tipo}`)}
        className="focus:border-amethyst-300/70 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/35"
      />
      )}

      {/* MEDIDA: cuánto sitio ocupa la escena. Solo dos opciones y solo donde el
          tipo lo permite — la portada va a sangre y eso no se negocia, porque un
          book donde todo se puede poner a pantalla completa acaba siendo lo que
          ya se rechazó una vez. */}
      {def.medida !== "sangre" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-silver-500 text-[0.65rem] tracking-[2px] uppercase">
            {t("medidaTitle")}
          </span>
          {MEDIDAS_ELEGIBLES.map((m) => {
            const on = medidaDeEscena(escena) === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => set({ medida: m as MedidaEscena })}
                aria-pressed={on}
                className={`rounded-full px-3 py-1.5 text-[0.65rem] font-semibold tracking-wide uppercase ring-1 transition ring-inset ${
                  on
                    ? "bg-amethyst-500/20 text-amethyst-100 ring-amethyst-300/60"
                    : "text-silver-400 bg-white/[0.04] ring-white/15 hover:bg-white/10"
                }`}
              >
                {t(`medidas.${m}`)}
              </button>
            );
          })}
        </div>
      )}

      {/* Los cuatro textos de esquina. Es lo que convierte una foto grande en una
          ficha de campaña, y es de donde sale el aire de "editorial" sin gastar
          un solo píxel más de imagen. */}
      {def.admiteMeta && (
        <div>
          <p className="text-silver-500 text-[0.65rem] tracking-[2px] uppercase">
            {t("meta.title")}
          </p>
          <p className="text-silver-500 mt-1 text-xs">{t("meta.hint")}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {META_ESQUINAS.map((k) => (
              <input
                key={k}
                value={escena.meta?.[k] ?? ""}
                onChange={(e) =>
                  set({ meta: { ...escena.meta, [k]: e.target.value } })
                }
                maxLength={BOOK_META_MAX}
                placeholder={t(`meta.${k}`)}
                className="focus:border-amethyst-300/70 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 font-mono text-xs tracking-widest text-white uppercase outline-none placeholder:text-white/30"
              />
            ))}
          </div>
        </div>
      )}

      <div className="og-book-escena">
        {/* `data-piezas` va con el MÁXIMO de la escena, no con las fotos que ya
            hay, y ahí estaba el bug reportado ("al ir agregando, el contenedor
            se vuelve torpe y se daña").

            El editor pinta SIEMPRE `max` celdas —las fotos más los huecos que
            faltan—, pero declaraba la rejilla del número de fotos SUBIDAS. Con
            una foto en un índice de cuatro, el CSS busca la composición de una
            pieza, no la encuentra (solo existen las de 3 y 4), se queda sin
            `grid-template-areas`… y los `grid-area: a` que este componente sigue
            poniendo caen en pistas implícitas. De ahí las tiras finas: celdas
            colocadas fuera de la composición, sin ancho que las sostenga.

            Con el máximo, la rejilla es la misma desde la primera foto hasta la
            última, que además es lo que hay que ver mientras se compone. */}
        <div
          className="og-book-grid"
          data-escena={escena.tipo}
          data-piezas={def.max}
        >
          {escena.piezas.map((pieza, i) => {
            const esOrigen = moviendo === i;
            const esDestino = moviendo !== null && !esOrigen;
            return (
              <div
                key={`${escena.id}-${i}`}
                style={{ gridArea: areaDeRanura(i) }}
                className={`og-book-pieza rounded-xl border transition ${
                  esOrigen ? "border-amethyst-300 ring-amethyst-300 ring-2" : "border-white/10"
                }`}
              >
                {/* El vídeo se representa con su PÓSTER: en el editor interesa
                    componer, y seis clips reproduciéndose a la vez mientras se
                    ordena el book es ruido y batería. */}
                <Image
                  src={pieza.tipo === "video" ? (pieza.poster ?? pieza.url) : pieza.url}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="object-cover"
                  unoptimized={pieza.tipo === "video" && !pieza.poster}
                />

                {pieza.tipo === "video" && (
                  <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
                    {t("clip")}
                  </span>
                )}

                {/* Qué papel juega esta foto en la secuencia. La apertura no
                    admite vídeo, así que nunca choca con la etiqueta de clip. */}
                {etiquetaRol(i) && (
                  <span className="absolute top-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
                    {etiquetaRol(i)}
                  </span>
                )}

                {/* Con una pieza "levantada", TODA la celda destino es el botón:
                    apuntar a un icono de 32px en un móvil es pedir puntería. */}
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
                    {escena.piezas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => elegirRanura(i)}
                        aria-label={esOrigen ? t("cancelMove") : t("moveAria", { n: i + 1 })}
                        className={`absolute bottom-2 left-2 flex size-8 items-center justify-center rounded-full backdrop-blur-sm transition ${
                          esOrigen
                            ? "bg-amethyst-400 text-black"
                            : "bg-black/55 text-white hover:bg-black/75"
                        }`}
                      >
                        {esOrigen ? <CloseIcon className="size-4" /> : <MoveIcon className="size-4" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        set({ piezas: escena.piezas.filter((_, j) => j !== i) })
                      }
                      aria-label={t("removeAria", { n: i + 1 })}
                      className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-red-500/70"
                    >
                      <CloseIcon className="size-4" />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {/* Huecos: la ranura vacía ES el botón de subir, en su sitio de la
              composición. Un "+" suelto debajo obliga a imaginar dónde caerá. */}
          {Array.from({ length: huecos }, (_, k) => {
            const i = escena.piezas.length + k;
            return (
              <UploadButton
                key={`hueco-${i}`}
                // El hueco ocupa SU ranura de la composición. Sin esto se
                // autocoloca, y una rejilla con áreas nombradas más piezas
                // autocolocadas mezcla las dos cosas de la peor manera.
                style={{ gridArea: areaDeRanura(i) }}
                accept="image/*,video/*"
                multiple
                disabled={subiendo || !puedeSubir}
                onFiles={onFiles}
                className="og-book-hueco flex flex-col items-center justify-center gap-1.5 px-2 text-center text-white/45 transition hover:border-white/50 hover:text-white disabled:opacity-40"
              >
                {subiendo ? (
                  <SpinnerIcon className="size-5 animate-spin" />
                ) : (
                  <PlusIcon className="size-5" />
                )}
                {/* El hueco vacío DICE qué va en él. Es donde de verdad hace
                    falta: con la foto ya puesta se adivina; vacío, no. */}
                {etiquetaRol(i) && (
                  <span className="text-[0.6rem] leading-tight font-semibold tracking-wide uppercase">
                    {etiquetaRol(i)}
                  </span>
                )}
              </UploadButton>
            );
          })}

          {def.maxNotas > 0 && (
            <div style={{ gridArea: "n" }} className="flex flex-col gap-3">
              {Array.from({ length: def.maxNotas }, (_, i) => {
                const nota = escena.notas?.[i];
                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    <input
                      value={nota?.titulo ?? ""}
                      onChange={(e) => {
                        const notas = [...(escena.notas ?? [])];
                        notas[i] = { ...notas[i], titulo: e.target.value };
                        set({ notas });
                      }}
                      maxLength={BOOK_TITULO_MAX}
                      placeholder={t("notaTituloPlaceholder")}
                      className="focus:border-amethyst-300/70 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                    />
                    <textarea
                      value={nota?.texto ?? ""}
                      onChange={(e) => {
                        const notas = [...(escena.notas ?? [])];
                        notas[i] = { ...notas[i], texto: e.target.value };
                        set({ notas });
                      }}
                      maxLength={BOOK_NOTA_MAX}
                      rows={2}
                      placeholder={t("notaTextoPlaceholder")}
                      className="focus:border-amethyst-300/70 resize-none rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {faltan > 0 && (
        <p className="text-warning/90 text-xs">
          {t("faltanPiezas", { count: faltan })}
        </p>
      )}
      {videosDeEscena(escena) >= def.maxVideos && def.maxVideos > 0 && (
        <p className="text-silver-500 text-xs">
          {t("topeVideos", { count: def.maxVideos })}
        </p>
      )}

      {/* Textos por pieza: fuera de la rejilla, en una lista. Superpuestos sobre
          las miniaturas no se leen ni se escriben, y son el motivo de que el
          book cuente algo en vez de ser fotos bonitas seguidas. */}
      {def.admiteTextoPorPieza && escena.piezas.length > 0 && (
        <div className="flex flex-col gap-3">
          {escena.piezas.map((pieza, i) => {
            // En la apertura solo escribe la foto DE PORTADA. Las otras tres son
            // imagen pura y ofrecerles campos de texto sería invitar a rellenar
            // algo que la secuencia no pinta en ninguna parte.
            if (escena.tipo === "portada" && !esFotoDePortada(escena.tipo, i)) {
              return null;
            }
            return (
            <div key={`txt-${i}`} className="flex flex-col gap-1.5">
              <p className="text-silver-500 text-[0.65rem] tracking-[2px] uppercase">
                {etiquetaRol(i) ?? t("piezaN", { n: i + 1 })}
              </p>
              {/* El crédito de la ficha del índice: va arriba, sobre una línea,
                  en mono-mayúsculas. Es lo que convierte una foto en una entrada
                  de catálogo. Solo se pide donde se pinta. */}
              {escena.tipo === "indice" && (
                <input
                  value={pieza.etiqueta ?? ""}
                  onChange={(e) => setPieza(i, { etiqueta: e.target.value })}
                  maxLength={BOOK_ETIQUETA_MAX}
                  placeholder={t("etiquetaPlaceholder")}
                  className="focus:border-amethyst-300/70 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 font-mono text-xs tracking-widest text-white uppercase outline-none placeholder:text-white/30"
                />
              )}
              <input
                value={pieza.titulo ?? ""}
                onChange={(e) => setPieza(i, { titulo: e.target.value })}
                maxLength={BOOK_TITULO_MAX}
                placeholder={t("tituloPlaceholder")}
                className="focus:border-amethyst-300/70 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
              />
              <textarea
                value={pieza.nota ?? ""}
                onChange={(e) => setPieza(i, { nota: e.target.value })}
                maxLength={BOOK_NOTA_MAX}
                rows={2}
                placeholder={
                  escena.tipo === "portada"
                    ? t("portadaNotaPlaceholder")
                    : t("notaPlaceholder")
                }
                className="focus:border-amethyst-300/70 resize-none rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
              />
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Botón de borrar la escena, para la cabecera de la tarjeta. */
export function BorrarEscena({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-silver-400 flex size-9 items-center justify-center rounded-full border border-white/15 transition hover:border-red-400/60 hover:text-red-300"
    >
      <TrashIcon className="size-4" />
    </button>
  );
}
