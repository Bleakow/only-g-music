"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  PlusIcon,
  TrashIcon,
  SpinnerIcon,
  CheckIcon,
  CloseIcon,
} from "@/components/icons";
import { formatCOP } from "@/domain/service";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import {
  type Movimiento,
  type GastoOcurrencia,
  type Periodo,
  type ConfirmacionEstado,
  estadoResultados,
  expandirGastos,
  pendientesDeConfirmar,
  cuentaEnPnl,
  esRecurrenteActivo,
  periodoMes,
  periodoAnio,
  PERIODO_TODO,
} from "@/domain/contabilidad";
import {
  listMovimientos,
  anularMovimiento,
  confirmarOcurrencia,
} from "../lib/movimientos-repo";
import { AddMovimientoModal } from "./AddMovimientoModal";

type PeriodoKey = "mes" | "anio" | "todo";
const PERIODOS: PeriodoKey[] = ["mes", "anio", "todo"];

export function AdminGastos() {
  const t = useTranslations();
  const locale = useLocale();
  const [now] = useState(() => Date.now());

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>("anio");
  const [confirming, setConfirming] = useState<Set<string>>(new Set());

  // Anulación (de un gasto único o de una serie recurrente)
  const [anularTarget, setAnularTarget] = useState<Movimiento | null>(null);
  const [anularMotivo, setAnularMotivo] = useState("");
  const [anularBusy, setAnularBusy] = useState(false);

  function load(): Promise<void> {
    return listMovimientos()
      .then((data) => {
        setMovimientos(data);
        setError(null);
      })
      .catch((e) => {
        console.error("[gastos] load:", e);
        setError(t("adminGastos.loadError"));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    listMovimientos()
      .then((data) => active && setMovimientos(data))
      .catch((e) => {
        if (!active) return;
        console.error("[gastos] load:", e);
        setError(t("adminGastos.loadError"));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [t]);

  const nowDate = new Date(now);
  const periodo: Periodo =
    periodoKey === "mes"
      ? periodoMes(nowDate.getFullYear(), nowDate.getMonth())
      : periodoKey === "anio"
        ? periodoAnio(nowDate.getFullYear())
        : PERIODO_TODO;

  const pendientes = pendientesDeConfirmar(movimientos, now);
  const pl = estadoResultados([], movimientos, periodo, now);
  const contables = expandirGastos(movimientos, periodo, now).filter(cuentaEnPnl);
  const recurrentes = movimientos.filter((m) => esRecurrenteActivo(m, now));
  const maxCat = Math.max(1, ...pl.gastosPorCategoria.map((c) => c.monto));

  async function confirmar(o: GastoOcurrencia, estado: ConfirmacionEstado) {
    if (!o.clave) return;
    const key = `${o.movimientoId}:${o.clave}`;
    setConfirming((s) => new Set(s).add(key));
    try {
      await confirmarOcurrencia(o.movimientoId, o.clave, estado);
      await load();
    } catch (e) {
      console.error("[gastos] confirmar:", e);
    } finally {
      setConfirming((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  }

  async function confirmarAnular() {
    if (!anularTarget || anularBusy) return;
    setAnularBusy(true);
    try {
      await anularMovimiento(anularTarget.id, anularMotivo.trim());
      setAnularTarget(null);
      setAnularMotivo("");
      await load();
    } catch (e) {
      console.error("[gastos] anular:", e);
    } finally {
      setAnularBusy(false);
    }
  }

  const anularEsSerie = anularTarget != null && anularTarget.recurrencia !== "unico";

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 pb-24 pt-28 sm:px-12">
      <Link
        href="/admin"
        className="text-sm text-silver-300 underline-offset-4 hover:text-white hover:underline"
      >
        {t("adminGastos.backToAdmin")}
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-narrow text-5xl font-bold uppercase sm:text-6xl">
            {t("adminGastos.title")}
          </h1>
          <p className="mt-2 max-w-xl text-silver-300">
            {t("adminGastos.intro")}
          </p>
        </div>
        <GlassButton
          onClick={() => setShowAdd(true)}
          className="!text-amethyst-200"
        >
          <PlusIcon className="size-4" />
          {t("adminGastos.addButton")}
        </GlassButton>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-silver-300">{t("common.loading")}</p>
      ) : (
        <>
          {/* Cola: por confirmar */}
          {pendientes.length > 0 && (
            <section className="mt-8 rounded-2xl border border-amber-300/30 bg-amber-500/[0.08] p-5">
              <h2 className="font-narrow text-xl font-bold uppercase text-amber-100">
                {t("adminGastos.toConfirm", { count: pendientes.length })}
              </h2>
              <p className="mt-1 text-sm text-amber-100/70">
                {t("adminGastos.toConfirmHint")}
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {pendientes.map((o) => {
                  const key = `${o.movimientoId}:${o.clave}`;
                  const busy = confirming.has(key);
                  return (
                    <li
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {o.concepto}
                        </p>
                        <p className="text-sm text-silver-400">
                          {fechaCorta(o.fecha, locale)} · {formatCOP(o.monto)} ·{" "}
                          {t(`adminGastos.categoria.${o.categoria}`)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <GlassButton
                          onClick={() => confirmar(o, "pagado")}
                          disabled={busy}
                          className="!text-emerald-300"
                        >
                          {busy ? (
                            <SpinnerIcon className="size-4 animate-spin" />
                          ) : (
                            <CheckIcon className="size-4" />
                          )}
                          {t("adminGastos.confirmYes")}
                        </GlassButton>
                        <GlassButton
                          onClick={() => confirmar(o, "no_pagado")}
                          disabled={busy}
                          className="!text-silver-300"
                        >
                          <CloseIcon className="size-4" />
                          {t("adminGastos.confirmNo")}
                        </GlassButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Selector de periodo */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {PERIODOS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPeriodoKey(k)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  periodoKey === k
                    ? "border-amethyst-300 bg-amethyst-500/15 text-white"
                    : "border-white/15 text-silver-300 hover:border-white/30 hover:text-white"
                }`}
              >
                {t(`adminFinanzas.period.${k}`)}
              </button>
            ))}
          </div>

          {/* Resumen */}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-amethyst-300/30 bg-amethyst-500/10 p-5">
              <p className="text-xs uppercase tracking-[2px] text-amethyst-200">
                {t("adminGastos.totalLabel")}
              </p>
              <p className="mt-1 font-narrow text-3xl font-bold text-white">
                {formatCOP(pl.gastos)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[2px] text-silver-400">
                {t("adminGastos.count")}
              </p>
              <p className="mt-1 font-narrow text-2xl font-bold text-white">
                {contables.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[2px] text-silver-400">
                {t("adminGastos.recurringActive")}
              </p>
              <p className="mt-1 font-narrow text-2xl font-bold text-white">
                {recurrentes.length}
              </p>
            </div>
          </div>

          {/* Gastos recurrentes (definiciones) */}
          {recurrentes.length > 0 && (
            <section className="mt-10">
              <h2 className="font-narrow text-2xl font-bold uppercase text-white">
                {t("adminGastos.recurring")}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {recurrentes.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {m.concepto}{" "}
                        <span className="text-xs font-normal text-amethyst-200">
                          · {t(`adminGastos.recurrencia.${m.recurrencia}`)}
                        </span>
                      </p>
                      <p className="text-sm text-silver-400">
                        {formatCOP(m.monto)} · {t(`adminGastos.categoria.${m.categoria}`)} ·{" "}
                        {t("adminGastos.since", { date: fechaCorta(m.fecha, locale) })}
                        {m.recurrenciaHasta
                          ? ` → ${fechaCorta(m.recurrenciaHasta, locale)}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAnularTarget(m);
                        setAnularMotivo("");
                      }}
                      className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-silver-300 transition hover:bg-red-500/10 hover:text-red-300"
                    >
                      {t("adminGastos.stopSeries")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Egresos del periodo (contabilizados) */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold uppercase text-white">
              {t("adminGastos.expensesInPeriod")}
            </h2>
            {contables.length === 0 ? (
              <p className="mt-2 text-silver-400">{t("adminGastos.empty")}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-silver-400">
                    <tr>
                      <th className="px-4 py-3">{t("adminGastos.colDate")}</th>
                      <th className="px-4 py-3">{t("adminGastos.colConcept")}</th>
                      <th className="px-4 py-3">{t("adminGastos.colCategory")}</th>
                      <th className="px-4 py-3 text-right">
                        {t("adminGastos.colAmount")}
                      </th>
                      <th className="px-4 py-3 text-right">
                        {t("adminGastos.colActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {contables.map((o) => {
                      const mov = movimientos.find((m) => m.id === o.movimientoId);
                      return (
                        <tr key={`${o.movimientoId}:${o.clave ?? o.fecha}`}>
                          <td className="px-4 py-3 text-silver-400">
                            {fechaCorta(o.fecha, locale)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-2 text-silver-100">
                              <span className="truncate">{o.concepto}</span>
                              {o.recurrente && (
                                <span
                                  className="shrink-0 rounded-full bg-amethyst-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amethyst-200"
                                  title={t("adminGastos.recurringTag")}
                                >
                                  ↻
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-silver-300">
                            {t(`adminGastos.categoria.${o.categoria}`)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                            {formatCOP(o.monto)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!o.recurrente && mov && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAnularTarget(mov);
                                  setAnularMotivo("");
                                }}
                                aria-label={t("adminGastos.void")}
                                className="inline-flex size-8 items-center justify-center rounded-full text-silver-400 transition hover:bg-red-500/10 hover:text-red-300"
                              >
                                <TrashIcon className="size-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Desglose por categoría */}
          {pl.gastosPorCategoria.length > 0 && (
            <section className="mt-10">
              <h2 className="font-narrow text-2xl font-bold uppercase text-white">
                {t("adminGastos.byCategory")}
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                {pl.gastosPorCategoria.map((c) => (
                  <div key={c.categoria} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-sm text-silver-300">
                      {t(`adminGastos.categoria.${c.categoria}`)}
                    </span>
                    <div className="h-6 flex-1 overflow-hidden rounded bg-white/5">
                      <div
                        className="h-full rounded bg-gradient-to-r from-silver-100 to-amethyst-300"
                        style={{ width: `${(c.monto / maxCat) * 100}%` }}
                      />
                    </div>
                    <span className="w-32 shrink-0 text-right text-sm font-semibold tabular-nums text-white">
                      {formatCOP(c.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <AddMovimientoModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false);
          load();
        }}
      />

      {/* Confirmación de anulación (único o serie) */}
      <GlassModal
        open={anularTarget !== null}
        onClose={() => !anularBusy && setAnularTarget(null)}
        title={
          anularEsSerie
            ? t("adminGastos.voidModal.titleSerie")
            : t("adminGastos.voidModal.title")
        }
        className="max-w-md"
      >
        <p className="text-sm text-silver-300">
          {anularEsSerie
            ? t("adminGastos.voidModal.messageSerie", {
                concept: anularTarget?.concepto ?? "",
              })
            : t("adminGastos.voidModal.message", {
                concept: anularTarget?.concepto ?? "",
              })}
        </p>
        <input
          value={anularMotivo}
          onChange={(e) => setAnularMotivo(e.target.value)}
          placeholder={t("adminGastos.voidModal.reasonPlaceholder")}
          className="mt-4 w-full rounded-lg bg-white/[0.06] px-3 py-2 text-white outline-none ring-1 ring-inset ring-white/20 transition focus:ring-white/50 placeholder:text-white/40"
        />
        <div className="mt-5 flex items-center justify-end gap-3">
          <GlassButton onClick={() => setAnularTarget(null)} disabled={anularBusy}>
            {t("adminGastos.voidModal.cancel")}
          </GlassButton>
          <GlassButton
            onClick={confirmarAnular}
            disabled={anularBusy}
            className="!text-red-300"
          >
            {anularBusy ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : (
              <TrashIcon className="size-4" />
            )}
            {anularEsSerie
              ? t("adminGastos.voidModal.confirmSerie")
              : t("adminGastos.voidModal.confirm")}
          </GlassButton>
        </div>
      </GlassModal>
    </main>
  );
}
