"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  ATMOSFERAS,
  FONDOS,
  LETRAS,
  RITMOS,
  TEXTURAS,
  acentoEfectivo,
  type Atmosfera,
} from "@only-g/shared-types/book";

/**
 * Panel de ATMÓSFERA: cómo la modelo pone su estilo sin poder romper el book.
 *
 * PRESETS PRIMERO, PERILLAS DESPUÉS. Cuatro ejes son ciento cuarenta y cuatro
 * combinaciones, y casi nadie quiere ser director de arte: arriba van cuatro
 * atmósferas ya compuestas que dejan el book bien de un clic, y debajo los ejes
 * sueltos para quien sí quiera afinar.
 *
 * Cada opción de FONDO trae su paleta completa (fondo, tinta, superficie,
 * línea), así que no hay combinación que produzca texto ilegible. Eso es lo que
 * permite ofrecer personalización de verdad en vez de un selector de color con
 * una advertencia debajo.
 */

/** Muestra viva: la atmósfera aplicada de verdad, no un cuadrado de color. */
function Muestra({
  atmosfera,
  accentDelPerfil,
  texto,
}: {
  atmosfera: Atmosfera;
  accentDelPerfil: string;
  texto: string;
}) {
  return (
    <span
      className="og-book-root flex h-14 w-full items-center justify-center overflow-hidden rounded-lg"
      data-fondo={atmosfera.fondo}
      data-letra={atmosfera.letra}
      data-textura={atmosfera.textura}
      style={
        {
          minHeight: 0,
          "--bk-acento": acentoEfectivo(atmosfera, accentDelPerfil),
        } as CSSProperties
      }
    >
      <span className="og-book-display text-lg">{texto}</span>
      <span
        className="ml-2 size-2 rounded-full"
        style={{ background: "var(--bk-acento)" }}
      />
    </span>
  );
}

function Fila<T extends string>({
  titulo,
  pista,
  opciones,
  valor,
  etiqueta,
  onPick,
}: {
  titulo: string;
  pista?: string;
  opciones: readonly T[];
  valor: T;
  etiqueta: (v: T) => string;
  onPick: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-silver-400 text-xs tracking-[2px] uppercase">{titulo}</p>
      {pista && <p className="text-silver-500 mt-1 text-xs">{pista}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {opciones.map((op) => {
          const on = op === valor;
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
    </div>
  );
}

export function AtmosferaPanel({
  atmosfera,
  accentDelPerfil,
  nombre,
  onChange,
}: {
  atmosfera: Atmosfera;
  accentDelPerfil: string;
  nombre: string;
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
      p.textura === atmosfera.textura,
  );

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
                <Muestra
                  atmosfera={{ ...ejes, acento: atmosfera.acento }}
                  accentDelPerfil={accentDelPerfil}
                  texto={nombre.slice(0, 10) || "Only G"}
                />
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

      <Fila
        titulo={t("fondoTitle")}
        opciones={FONDOS}
        valor={atmosfera.fondo}
        etiqueta={(v) => t(`fondos.${v}`)}
        onPick={(fondo) => set({ fondo })}
      />
      <Fila
        titulo={t("letraTitle")}
        opciones={LETRAS}
        valor={atmosfera.letra}
        etiqueta={(v) => t(`letras.${v}`)}
        onPick={(letra) => set({ letra })}
      />
      <Fila
        titulo={t("ritmoTitle")}
        pista={t(`ritmosHint.${atmosfera.ritmo}`)}
        opciones={RITMOS}
        valor={atmosfera.ritmo}
        etiqueta={(v) => t(`ritmos.${v}`)}
        onPick={(ritmo) => set({ ritmo })}
      />
      <Fila
        titulo={t("texturaTitle")}
        opciones={TEXTURAS}
        valor={atmosfera.textura}
        etiqueta={(v) => t(`texturas.${v}`)}
        onPick={(textura) => set({ textura })}
      />

      {/* ACENTO. Por defecto hereda el del perfil: un book que arranca con el
          color que la modelo ya eligió es coherente sin que ella toque nada. */}
      <div>
        <p className="text-silver-400 text-xs tracking-[2px] uppercase">
          {t("acentoTitle")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => set({ acento: undefined })}
            aria-pressed={!atmosfera.acento}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold tracking-wide uppercase ring-1 transition ring-inset ${
              !atmosfera.acento
                ? "bg-amethyst-500/20 text-amethyst-100 ring-amethyst-300/60"
                : "text-silver-300 bg-white/[0.04] ring-white/15 hover:bg-white/10"
            }`}
          >
            <span
              className="size-3 rounded-full"
              style={{ background: accentDelPerfil }}
            />
            {t("acentoHeredado")}
          </button>
          <label className="text-silver-300 flex cursor-pointer items-center gap-2 rounded-full bg-white/[0.04] px-4 py-2 text-xs font-semibold tracking-wide uppercase ring-1 ring-white/15 transition ring-inset hover:bg-white/10">
            <input
              type="color"
              value={atmosfera.acento ?? accentDelPerfil}
              onChange={(e) => set({ acento: e.target.value })}
              className="size-4 cursor-pointer appearance-none border-0 bg-transparent p-0"
            />
            {t("acentoPropio")}
          </label>
        </div>
      </div>
    </div>
  );
}
