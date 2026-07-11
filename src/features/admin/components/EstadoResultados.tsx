"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import type { Transaccion } from "@/domain/transaccion";
import { formatCOP } from "@/domain/service";
import {
  type Movimiento,
  type Periodo,
  estadoResultados,
  periodoMes,
  periodoAnio,
  PERIODO_TODO,
} from "@/domain/contabilidad";

const DAY_MS = 86_400_000;
type PeriodoKey = "mes" | "anio" | "todo" | "custom";
const PRESETS: PeriodoKey[] = ["mes", "anio", "todo", "custom"];

/**
 * Estado de Resultados (P&L) del periodo: ingresos (transacciones, misma fuente
 * que la tabla de finanzas) − gastos (movimientos vigentes) = utilidad. El cálculo
 * es puro (`estadoResultados`); aquí solo se elige el periodo y se pinta.
 */
export function EstadoResultados({
  txs,
  movimientos,
}: {
  txs: Transaccion[];
  movimientos: Movimiento[];
}) {
  const t = useTranslations();
  const [nowMs] = useState(() => Date.now());
  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>("mes");
  const [customDesde, setCustomDesde] = useState("");
  const [customHasta, setCustomHasta] = useState("");

  const periodo: Periodo = useMemo(() => {
    const d = new Date(nowMs);
    if (periodoKey === "mes") return periodoMes(d.getFullYear(), d.getMonth());
    if (periodoKey === "anio") return periodoAnio(d.getFullYear());
    if (periodoKey === "custom") {
      return {
        desde: customDesde ? new Date(customDesde).getTime() : null,
        // Fin inclusivo: incluye todo el día seleccionado.
        hasta: customHasta ? new Date(customHasta).getTime() + DAY_MS : null,
      };
    }
    return PERIODO_TODO;
  }, [periodoKey, customDesde, customHasta, nowMs]);

  const pl = estadoResultados(txs, movimientos, periodo, nowMs);
  const maxFlujo = Math.max(1, pl.ingresos, pl.gastos);
  const positivo = pl.utilidad >= 0;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-narrow text-2xl font-bold text-white uppercase">
          {t("adminFinanzas.pnlTitle")}
        </h2>
        <Link
          href="/admin/gastos"
          className="text-amethyst-200 text-sm underline-offset-4 hover:text-white hover:underline"
        >
          {t("adminFinanzas.manageExpenses")}
        </Link>
      </div>

      {/* Selector de periodo */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setPeriodoKey(k)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
              periodoKey === k
                ? "border-amethyst-300 bg-amethyst-500/15 text-white"
                : "text-silver-300 border-white/15 hover:border-white/30 hover:text-white"
            }`}
          >
            {t(`adminFinanzas.period.${k}`)}
          </button>
        ))}
        {periodoKey === "custom" && (
          <div className="flex items-center gap-2">
            <DatePicker
              value={customDesde}
              onChange={setCustomDesde}
              max={customHasta || undefined}
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white ring-1 ring-white/20 transition ring-inset focus:ring-white/50"
            />
            <span className="text-silver-500">→</span>
            <DatePicker
              value={customHasta}
              onChange={setCustomHasta}
              min={customDesde || undefined}
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white ring-1 ring-white/20 transition ring-inset focus:ring-white/50"
            />
          </div>
        )}
      </div>

      {/* Ingresos / Gastos / Utilidad */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-silver-400 text-xs tracking-[2px] uppercase">
            {t("adminFinanzas.pnlRevenue")}
          </p>
          <p className="font-narrow mt-1 text-2xl font-bold text-white">
            {formatCOP(pl.ingresos)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-silver-400 text-xs tracking-[2px] uppercase">
            {t("adminFinanzas.pnlExpenses")}
          </p>
          <p className="font-narrow mt-1 text-2xl font-bold text-white">
            {formatCOP(pl.gastos)}
          </p>
        </div>
        <div
          className={`rounded-2xl border p-5 ${
            positivo
              ? "border-emerald-300/30 bg-emerald-500/10"
              : "border-red-300/30 bg-red-500/10"
          }`}
        >
          <p
            className={`text-xs tracking-[2px] uppercase ${
              positivo ? "text-emerald-200" : "text-red-200"
            }`}
          >
            {t("adminFinanzas.pnlProfit")}
          </p>
          <p className="font-narrow mt-1 text-2xl font-bold text-white">
            {formatCOP(pl.utilidad)}
          </p>
          <p className="text-silver-400 mt-1 text-xs">
            {t("adminFinanzas.pnlMargin", {
              value: Math.round(pl.margen * 100),
            })}
          </p>
        </div>
      </div>

      {/* Ingresos vs gastos (barras comparativas) */}
      <div className="mt-5 flex flex-col gap-2">
        <FlujoBar
          label={t("adminFinanzas.pnlRevenue")}
          value={pl.ingresos}
          max={maxFlujo}
          tone="rev"
        />
        <FlujoBar
          label={t("adminFinanzas.pnlExpenses")}
          value={pl.gastos}
          max={maxFlujo}
          tone="exp"
        />
      </div>

      {/* Gastos por categoría en el periodo */}
      {pl.gastosPorCategoria.length > 0 && (
        <div className="mt-6">
          <h3 className="text-silver-300 text-sm font-semibold tracking-wide uppercase">
            {t("adminFinanzas.pnlExpensesByCategory")}
          </h3>
          <ul className="mt-3 flex flex-col gap-1.5">
            {pl.gastosPorCategoria.map((c) => (
              <li
                key={c.categoria}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-silver-300">
                  {t(`adminGastos.categoria.${c.categoria}`)}
                </span>
                <span className="font-semibold text-white tabular-nums">
                  {formatCOP(c.monto)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function FlujoBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "rev" | "exp";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-silver-400 w-20 shrink-0 text-xs tracking-wide uppercase">
        {label}
      </span>
      <div className="h-5 flex-1 overflow-hidden rounded bg-white/5">
        <div
          className={`h-full rounded ${
            tone === "rev"
              ? "from-silver-100 to-amethyst-300 bg-gradient-to-r"
              : "bg-gradient-to-r from-red-400/70 to-red-300"
          }`}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="w-28 shrink-0 text-right text-sm font-semibold text-white tabular-nums">
        {formatCOP(value)}
      </span>
    </div>
  );
}
