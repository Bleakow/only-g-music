"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
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
import { AdminPageHeader, adminCard, adminInner } from "./admin-ui";
import { Skeleton } from "@/components/ui/Skeleton";

type PeriodoKey = "mes" | "anio" | "todo";
const PERIODOS: PeriodoKey[] = ["mes", "anio", "todo"];

export function AdminGastos({ embedded = false }: { embedded?: boolean } = {}) {
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
  const contables = expandirGastos(movimientos, periodo, now).filter(
    cuentaEnPnl,
  );
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

  const anularEsSerie =
    anularTarget != null && anularTarget.recurrencia !== "unico";

  return (
    <div className={embedded ? "" : "pb-24"}>
      {!embedded && (
        <AdminPageHeader
          eyebrow={t("adminDashboard.eyebrow")}
          title={t("adminGastos.title")}
          subtitle={t("adminGastos.intro")}
        />
      )}

      <div className={embedded ? "" : "px-6 sm:px-10"}>
        <div
          className={
            embedded
              ? "flex flex-wrap items-end justify-between gap-4"
              : "flex justify-end"
          }
        >
          {embedded && (
            <div>
              <h1 className="font-narrow text-3xl font-bold text-white uppercase sm:text-4xl">
                {t("adminGastos.title")}
              </h1>
              <p className="text-silver-300 mt-2 max-w-xl text-sm">
                {t("adminGastos.intro")}
              </p>
            </div>
          )}
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
          <>
            {/* Selector de periodo (skeleton) */}
            <div className="mt-8 flex flex-wrap items-center gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20" />
              ))}
            </div>

            {/* Resumen (skeleton) */}
            <div className={`${adminCard} mt-4 grid gap-4 p-5 sm:grid-cols-3`}>
              <div className="border-amethyst-300/30 bg-amethyst-500/10 rounded-xl border p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-8 w-32" />
              </div>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className={`${adminInner} rounded-xl p-4`}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-6 w-12" />
                </div>
              ))}
            </div>

            {/* Egresos del periodo (skeleton) */}
            <section className={`${adminCard} mt-10 p-5`}>
              <Skeleton className="h-6 w-56" />
              <div className={`${adminInner} mt-4 overflow-hidden rounded-xl`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="ml-auto h-4 w-24" />
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Cola: por confirmar */}
            {pendientes.length > 0 && (
              <section className="mt-8 rounded-2xl border border-amber-300/30 bg-amber-500/[0.08] p-5 backdrop-blur-sm">
                <h2 className="font-narrow text-xl font-bold text-amber-100 uppercase">
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
                        className={`${adminInner} flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            {o.concepto}
                          </p>
                          <p className="text-silver-400 text-sm">
                            {fechaCorta(o.fecha, locale)} · {formatCOP(o.monto)}{" "}
                            · {t(`adminGastos.categoria.${o.categoria}`)}
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
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                    periodoKey === k
                      ? "border-amethyst-300 bg-amethyst-500/15 text-white"
                      : "text-silver-300 border-white/15 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {t(`adminFinanzas.period.${k}`)}
                </button>
              ))}
            </div>

            {/* Resumen */}
            <div className={`${adminCard} mt-4 grid gap-4 p-5 sm:grid-cols-3`}>
              <div className="border-amethyst-300/30 bg-amethyst-500/10 rounded-xl border p-4">
                <p className="text-amethyst-200 text-xs tracking-[2px] uppercase">
                  {t("adminGastos.totalLabel")}
                </p>
                <p className="font-narrow mt-1 text-3xl font-bold text-white">
                  {formatCOP(pl.gastos)}
                </p>
              </div>
              <div className={`${adminInner} rounded-xl p-4`}>
                <p className="text-silver-400 text-xs tracking-[2px] uppercase">
                  {t("adminGastos.count")}
                </p>
                <p className="font-narrow mt-1 text-2xl font-bold text-white">
                  {contables.length}
                </p>
              </div>
              <div className={`${adminInner} rounded-xl p-4`}>
                <p className="text-silver-400 text-xs tracking-[2px] uppercase">
                  {t("adminGastos.recurringActive")}
                </p>
                <p className="font-narrow mt-1 text-2xl font-bold text-white">
                  {recurrentes.length}
                </p>
              </div>
            </div>

            {/* Gastos recurrentes (definiciones) */}
            {recurrentes.length > 0 && (
              <section className={`${adminCard} mt-10 p-5`}>
                <h2 className="font-narrow text-2xl font-bold text-white uppercase">
                  {t("adminGastos.recurring")}
                </h2>
                <ul className="mt-4 flex flex-col gap-2">
                  {recurrentes.map((m) => (
                    <li
                      key={m.id}
                      className={`${adminInner} flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {m.concepto}{" "}
                          <span className="text-amethyst-200 text-xs font-normal">
                            · {t(`adminGastos.recurrencia.${m.recurrencia}`)}
                          </span>
                        </p>
                        <p className="text-silver-400 text-sm">
                          {formatCOP(m.monto)} ·{" "}
                          {t(`adminGastos.categoria.${m.categoria}`)} ·{" "}
                          {t("adminGastos.since", {
                            date: fechaCorta(m.fecha, locale),
                          })}
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
                        className="text-silver-300 shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition hover:bg-red-500/10 hover:text-red-300"
                      >
                        {t("adminGastos.stopSeries")}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Egresos del periodo (contabilizados) */}
            <section className={`${adminCard} mt-10 p-5`}>
              <h2 className="font-narrow text-2xl font-bold text-white uppercase">
                {t("adminGastos.expensesInPeriod")}
              </h2>
              {contables.length === 0 ? (
                <p className="text-silver-400 mt-2">{t("adminGastos.empty")}</p>
              ) : (
                <div
                  className={`${adminInner} mt-4 overflow-x-auto rounded-xl`}
                >
                  <table className="w-full min-w-[44rem] text-left text-sm">
                    <thead className="text-silver-400 bg-white/[0.03] text-xs tracking-wide uppercase">
                      <tr>
                        <th className="px-4 py-3">
                          {t("adminGastos.colDate")}
                        </th>
                        <th className="px-4 py-3">
                          {t("adminGastos.colConcept")}
                        </th>
                        <th className="px-4 py-3">
                          {t("adminGastos.colCategory")}
                        </th>
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
                        const mov = movimientos.find(
                          (m) => m.id === o.movimientoId,
                        );
                        return (
                          <tr key={`${o.movimientoId}:${o.clave ?? o.fecha}`}>
                            <td className="text-silver-400 px-4 py-3">
                              {fechaCorta(o.fecha, locale)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-silver-100 flex items-center gap-2">
                                <span className="truncate">{o.concepto}</span>
                                {o.recurrente && (
                                  <span
                                    className="bg-amethyst-500/20 text-amethyst-200 shrink-0 rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase"
                                    title={t("adminGastos.recurringTag")}
                                  >
                                    ↻
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="text-silver-300 px-4 py-3">
                              {t(`adminGastos.categoria.${o.categoria}`)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">
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
                                  className="text-silver-400 inline-flex size-8 items-center justify-center rounded-full transition hover:bg-red-500/10 hover:text-red-300"
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
              <section className={`${adminCard} mt-10 p-5`}>
                <h2 className="font-narrow text-2xl font-bold text-white uppercase">
                  {t("adminGastos.byCategory")}
                </h2>
                <div className="mt-4 flex flex-col gap-2">
                  {pl.gastosPorCategoria.map((c) => (
                    <div key={c.categoria} className="flex items-center gap-3">
                      <span className="text-silver-300 w-40 shrink-0 truncate text-sm">
                        {t(`adminGastos.categoria.${c.categoria}`)}
                      </span>
                      <div className="h-6 flex-1 overflow-hidden rounded bg-white/5">
                        <div
                          className="from-silver-100 to-amethyst-300 h-full rounded bg-gradient-to-r"
                          style={{ width: `${(c.monto / maxCat) * 100}%` }}
                        />
                      </div>
                      <span className="w-32 shrink-0 text-right text-sm font-semibold text-white tabular-nums">
                        {formatCOP(c.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

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
        <p className="text-silver-300 text-sm">
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
          className="mt-4 w-full rounded-lg bg-white/[0.06] px-3 py-2 text-white ring-1 ring-white/20 transition outline-none ring-inset placeholder:text-white/40 focus:ring-white/50"
        />
        <div className="mt-5 flex items-center justify-end gap-3">
          <GlassButton
            onClick={() => setAnularTarget(null)}
            disabled={anularBusy}
          >
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
    </div>
  );
}
