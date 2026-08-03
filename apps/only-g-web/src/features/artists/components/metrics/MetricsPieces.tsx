"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { formatCompact } from "@only-g/shared-types/artist-profile";
import type { RankedEntry } from "@only-g/shared-types/profile-metrics";
import { TrendingUpIcon, TrendingDownIcon } from "@/components/icons";

/**
 * Piezas del panel de Métricas (§04, frame `ZEaMA`). Viven juntas porque
 * comparten el mismo lenguaje visual —panel de tinta, borde tenue, acento
 * amatista— y separarlas en seis archivos solo añadiría saltos de contexto.
 */

/** Panel base: la caja de todas las secciones del mockup. */
export function MetricPanel({
  title,
  subtitle,
  aside,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-ink-panel rounded-[18px] border border-white/[0.08] p-5 sm:p-6 ${className}`}
    >
      {(title || aside) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase sm:text-xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-silver-400 mt-0.5 text-xs">{subtitle}</p>
            )}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Variación respecto al periodo anterior. `null` = no había con qué comparar, y
 * entonces NO se pinta nada: un "+100%" que en realidad significa "antes no
 * teníamos datos" es peor que no decir nada.
 */
export function DeltaChip({ delta }: { delta: number | null }) {
  const t = useTranslations("metrics");
  if (delta === null) return null;
  const up = delta >= 0;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  return (
    <span
      title={t("vsPrevious")}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        up
          ? "bg-emerald-400/10 text-emerald-300"
          : "bg-red-400/10 text-red-300"
      }`}
    >
      <Icon className="size-3" />
      {up ? "+" : ""}
      {delta}%
    </span>
  );
}

/**
 * Sparkline de barras. Las del PERIODO ACTUAL van en amatista y el resto en
 * plata apagada, igual que el mockup: se lee de un vistazo qué es tendencia
 * reciente y qué es historia.
 */
export function Sparkline({
  values,
  highlightLast = 4,
}: {
  values: number[];
  highlightLast?: number;
}) {
  const max = Math.max(1, ...values);
  const from = Math.max(0, values.length - highlightLast);
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={`flex-1 rounded-[2px] ${
            i >= from ? "bg-amethyst-400" : "bg-silver-500/25"
          }`}
          // Mínimo del 8% para que un día a cero siga siendo una marca visible
          // y no un hueco que rompa el ritmo de la línea.
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** Tarjeta KPI: icono, variación, cifra grande, etiqueta y sparkline. */
export function MetricKpi({
  icon,
  label,
  value,
  delta,
  serie,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  delta: number | null;
  serie: number[];
}) {
  return (
    <div className="bg-ink-panel rounded-[18px] border border-white/[0.08] p-5">
      <div className="flex items-center justify-between">
        <span className="text-amethyst-300">{icon}</span>
        <DeltaChip delta={delta} />
      </div>
      <p
        className="font-narrow mt-2 text-3xl font-bold text-white sm:text-4xl"
        // El título lleva la cifra exacta: "24.8K" es cómodo de leer, pero a
        // veces uno quiere el número real sin tener que abrir una hoja de cálculo.
        title={value.toLocaleString()}
      >
        {formatCompact(value)}
      </p>
      <p className="font-narrow text-silver-400 mt-1 text-[11px] font-semibold tracking-[2px] uppercase">
        {label}
      </p>
      <div className="mt-3">
        <Sparkline values={serie} />
      </div>
    </div>
  );
}

/**
 * Lista rankeada con barra de progreso (top países, clics por red, canciones).
 * `renderLabel` deja que cada uso ponga su adorno —bandera, icono de red,
 * número de posición— sin duplicar la mecánica de la barra.
 */
export function RankedList({
  entries,
  renderLabel,
  accent = "#a78bfa",
  emptyText,
  showShare = false,
}: {
  entries: RankedEntry[];
  renderLabel: (entry: RankedEntry, index: number) => ReactNode;
  accent?: string;
  emptyText: string;
  /** Muestra "12.4%" además del valor absoluto. */
  showShare?: boolean;
}) {
  const reduce = useReducedMotion();
  if (entries.length === 0) {
    return (
      <p className="text-silver-500 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs">
        {emptyText}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {entries.map((e, i) => (
        <li key={e.key}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-silver-100 flex min-w-0 items-center gap-2.5 text-sm">
              {renderLabel(e, i)}
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              {showShare && (
                <span className="text-silver-500 text-[11px] tabular-nums">
                  {e.share.toFixed(1)}%
                </span>
              )}
              <span className="font-narrow text-silver-100 text-sm font-bold tabular-nums">
                {formatCompact(e.value)}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${accent}, ${accent}80)`,
              }}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${e.pct}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Gráfica de barras por día. Sin librería: son barras con altura proporcional,
 * y una tabla accesible detrás para quien navegue con lector de pantalla.
 */
export function DailyBars({
  serie,
  accent = "#a78bfa",
  label,
}: {
  serie: { dia: string; value: number }[];
  accent?: string;
  label: string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...serie.map((d) => d.value));
  // Con 30–90 barras no caben todas las fechas: se etiquetan primera, media y
  // última, que es lo que da sentido de recorrido sin apelmazar el eje.
  const marks = [0, Math.floor(serie.length / 2), serie.length - 1];

  return (
    <div>
      <div
        className="flex h-44 items-end gap-[2px]"
        role="img"
        aria-label={label}
      >
        {serie.map((d, i) => (
          <motion.div
            key={d.dia}
            className="min-w-[3px] flex-1 rounded-t-[3px]"
            style={{
              background: `linear-gradient(180deg, ${accent}, ${accent}55)`,
            }}
            title={`${d.dia}: ${d.value}`}
            initial={reduce ? false : { height: 0 }}
            animate={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            transition={{
              duration: 0.5,
              delay: Math.min(i * 0.01, 0.4),
              ease: "easeOut",
            }}
          />
        ))}
      </div>
      <div className="text-silver-500 mt-2 flex justify-between text-[10px]">
        {marks.map((m) => (
          <span key={m}>{serie[m]?.dia.slice(5) ?? ""}</span>
        ))}
      </div>
    </div>
  );
}
