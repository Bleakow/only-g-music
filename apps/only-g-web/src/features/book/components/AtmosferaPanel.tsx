"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ATMOSFERAS,
  DESINTEGRADOS,
  FONDOS,
  LETRAS,
  RITMOS,
  TEXTURAS,
  type Atmosfera,
} from "@only-g/shared-types/book";
import { DesintegradoPreview } from "./DesintegradoPreview";

/**
 * Panel de ATMÓSFERA: cómo la modelo pone su estilo sin poder romper el book.
 *
 * PRESETS PRIMERO, PERILLAS DESPUÉS. Arriba, cuatro atmósferas ya compuestas que
 * dejan el book bien de un clic; debajo, los ejes sueltos para quien quiera
 * afinar. Casi nadie quiere ser director de arte.
 *
 * CADA BOTÓN ENSEÑA LO QUE ELIGE, y eso es lo que separa este panel de una lista
 * de nombres. Un chip que pone "Vintage" no dice de qué color es y "Grotesca" no
 * dice cómo se lee: aquí el fondo se ve en su color, la letra está escrita en su
 * propia tipografía y la textura se muestra sobre su propio fondo. Es la misma
 * regla que ya rige las miniaturas de escena y la vista previa del desintegrado,
 * y por la misma razón: enseñar la cosa real, no un dibujo aparte que acabará
 * divergiendo.
 *
 * Y las muestras se pintan con `.og-book-root` y los `data-*` DE VERDAD, así que
 * salen del mismo CSS que el book. No hay una paleta duplicada en JavaScript que
 * pueda quedarse atrás el día que alguien retoque un color.
 *
 * NO HAY SELECTOR DE ACENTO. Se quitó a propósito: un color libre suelto por el
 * book —un botón fucsia en un portafolio de moda— le quitaba seriedad al perfil.
 * El acento sale ahora de la paleta de cada fondo, así que va a juego por
 * construcción y no hay forma de desafinarlo.
 */

/** Una muestra viva: la atmósfera aplicada de verdad, no un cuadrado pintado. */
function Muestra({
  atmosfera,
  texto,
}: {
  atmosfera: Pick<Atmosfera, "fondo" | "letra" | "textura">;
  texto: string;
}) {
  return (
    <span
      className="og-book-root relative flex h-14 w-full items-center justify-center overflow-hidden rounded-lg"
      data-fondo={atmosfera.fondo}
      data-letra={atmosfera.letra}
      data-textura={atmosfera.textura}
      // La capa de textura del book es `fixed` —el grano no puede viajar con el
      // scroll o deja de leerse como grano de película— y aquí tiene que quedarse
      // en su caja. Ver `[data-muestra]` en `book.css`.
      data-muestra=""
      style={{ minHeight: 0 }}
    >
      <span className="og-book-display text-lg">{texto}</span>
    </span>
  );
}

/**
 * Una fila de opciones. `muestra` es lo que convierte el botón en algo que se
 * mira en vez de leerse; cuando falta queda el chip de siempre, que es lo
 * correcto para el ritmo — ahí no hay nada que enseñar sin moverlo.
 */
function Fila<T extends string>({
  titulo,
  pista,
  opciones,
  valor,
  etiqueta,
  muestra,
  onPick,
  children,
}: {
  titulo: string;
  pista?: string;
  opciones: readonly T[];
  valor: T;
  etiqueta: (v: T) => string;
  muestra?: (v: T) => ReactNode;
  onPick: (v: T) => void;
  /** Se pinta DEBAJO de los botones: primero se elige, luego se comprueba. */
  children?: ReactNode;
}) {
  return (
    <div>
      <p className="text-silver-400 text-xs tracking-[2px] uppercase">{titulo}</p>
      {pista && <p className="text-silver-500 mt-1 text-xs">{pista}</p>}
      <div
        className={
          muestra
            ? "mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
            : "mt-2 flex flex-wrap gap-2"
        }
      >
        {opciones.map((op) => {
          const on = op === valor;
          if (muestra) {
            return (
              <button
                key={op}
                type="button"
                onClick={() => onPick(op)}
                aria-pressed={on}
                className={`flex flex-col gap-1.5 rounded-xl p-1.5 ring-1 transition ring-inset ${
                  on
                    ? "ring-amethyst-300/70 bg-amethyst-500/10"
                    : "ring-white/15 hover:ring-white/40"
                }`}
              >
                {muestra(op)}
                <span
                  className={`text-[0.6rem] font-semibold tracking-wide uppercase ${
                    on ? "text-amethyst-100" : "text-silver-400"
                  }`}
                >
                  {etiqueta(op)}
                </span>
              </button>
            );
          }
          return (
            <button
              key={op}
              type="button"
              onClick={() => onPick(op)}
              aria-pressed={on}
              className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wide uppercase ring-1 transition ring-inset ${
                on
                  ? "bg-amethyst-500/20 text-amethyst-100 ring-amethyst-300/60"
                  : "text-silver-300 bg-white/[0.04] ring-white/15 hover:bg-white/10 hover:text-white"
              }`}
            >
              {etiqueta(op)}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

export function AtmosferaPanel({
  atmosfera,
  nombre,
  portadaUrl,
  onChange,
}: {
  atmosfera: Atmosfera;
  nombre: string;
  /** La foto de portada del book: la vista previa se hace con SU imagen. */
  portadaUrl?: string;
  onChange: (a: Atmosfera) => void;
}) {
  const t = useTranslations("bookEditor.atmosfera");
  const set = (parcial: Partial<Atmosfera>) =>
    onChange({ ...atmosfera, ...parcial });

  const activo = ATMOSFERAS.find(
    (p) =>
      p.fondo === atmosfera.fondo &&
      p.letra === atmosfera.letra &&
      p.ritmo === atmosfera.ritmo &&
      p.textura === atmosfera.textura &&
      p.desintegrado === atmosfera.desintegrado,
  );

  const muestraTexto = nombre.slice(0, 8) || "Only G";

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="text-silver-400 text-xs tracking-[2px] uppercase">
          {t("presetsTitle")}
        </p>
        <p className="text-silver-500 mt-1 text-xs">{t("presetsHint")}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ATMOSFERAS.map((preset) => {
            const { id, ...ejes } = preset;
            const on = activo?.id === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => set(ejes)}
                aria-pressed={on}
                className={`flex flex-col gap-2 rounded-xl p-2 ring-1 transition ring-inset ${
                  on
                    ? "ring-amethyst-300/70 bg-amethyst-500/10"
                    : "ring-white/15 hover:ring-white/35"
                }`}
              >
                <Muestra atmosfera={ejes} texto={muestraTexto} />
                <span
                  className={`text-[0.65rem] font-semibold tracking-wide uppercase ${
                    on ? "text-amethyst-100" : "text-silver-400"
                  }`}
                >
                  {t(`presets.${id}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FONDO. La muestra lleva la letra y la textura que YA tiene elegidas: lo
          que hay que comparar es cómo queda SU book en ese color, no el color
          suelto en un cuadrado. */}
      <Fila
        titulo={t("fondoTitle")}
        opciones={FONDOS}
        valor={atmosfera.fondo}
        etiqueta={(v) => t(`fondos.${v}`)}
        muestra={(fondo) => (
          <Muestra atmosfera={{ ...atmosfera, fondo }} texto={muestraTexto} />
        )}
        onPick={(fondo) => set({ fondo })}
      />

      {/* LETRA. Cada botón está escrito en su propia tipografía. "Aa" y no el
          nombre: media decisión es cómo cae la minúscula al lado de la caja
          alta, y en mayúsculas condensadas eso no se ve. */}
      <Fila
        titulo={t("letraTitle")}
        opciones={LETRAS}
        valor={atmosfera.letra}
        etiqueta={(v) => t(`letras.${v}`)}
        muestra={(letra) => (
          <Muestra atmosfera={{ ...atmosfera, letra }} texto="Aa" />
        )}
        onPick={(letra) => set({ letra })}
      />

      {/* RITMO. El único eje sin muestra, y a propósito: es movimiento puro y una
          caja quieta no puede enseñarlo sin mentir. Se describe con palabras,
          que es lo honesto. */}
      <Fila
        titulo={t("ritmoTitle")}
        pista={t(`ritmosHint.${atmosfera.ritmo}`)}
        opciones={RITMOS}
        valor={atmosfera.ritmo}
        etiqueta={(v) => t(`ritmos.${v}`)}
        onPick={(ritmo) => set({ ritmo })}
      />

      {/* CÓMO SE DESHACE LA PORTADA. Aquí la muestra no cabe en un botón —es una
          secuencia— así que va una sola debajo, con la opción activa. */}
      <Fila
        titulo={t("desintegradoTitle")}
        pista={t(`desintegradosHint.${atmosfera.desintegrado}`)}
        opciones={DESINTEGRADOS}
        valor={atmosfera.desintegrado}
        etiqueta={(v) => t(`desintegrados.${v}`)}
        onPick={(desintegrado) => set({ desintegrado })}
      >
        <DesintegradoPreview
          url={portadaUrl}
          desintegrado={atmosfera.desintegrado}
        />
      </Fila>

      {/* TEXTURA. Se ve poco a propósito —es un velo, no un estampado— así que la
          muestra la enseña sobre su propio fondo: en un cuadrado gris no se
          distinguiría el grano de la viñeta. */}
      <Fila
        titulo={t("texturaTitle")}
        opciones={TEXTURAS}
        valor={atmosfera.textura}
        etiqueta={(v) => t(`texturas.${v}`)}
        muestra={(textura) => (
          <Muestra atmosfera={{ ...atmosfera, textura }} texto={muestraTexto} />
        )}
        onPick={(textura) => set({ textura })}
      />
    </div>
  );
}
