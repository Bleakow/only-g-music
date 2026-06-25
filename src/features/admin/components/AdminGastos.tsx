"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { PlusIcon, TrashIcon, SpinnerIcon } from "@/components/icons";
import { formatCOP } from "@/domain/service";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import {
  type Movimiento,
  estadoResultados,
  movimientoVigente,
  PERIODO_TODO,
} from "@/domain/contabilidad";
import { listMovimientos, anularMovimiento } from "../lib/movimientos-repo";
import { AddMovimientoModal } from "./AddMovimientoModal";

export function AdminGastos() {
  const t = useTranslations();
  const locale = useLocale();
  const [now] = useState(() => Date.now());

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Anulación
  const [anularTarget, setAnularTarget] = useState<Movimiento | null>(null);
  const [anularMotivo, setAnularMotivo] = useState("");
  const [anularBusy, setAnularBusy] = useState(false);

  function recargar() {
    setLoading(true);
    listMovimientos()
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

  // Reusa el P&L puro con ingresos vacíos → total de gastos + desglose.
  const pl = estadoResultados([], movimientos, PERIODO_TODO, now);
  const maxCat = Math.max(1, ...pl.gastosPorCategoria.map((c) => c.monto));
  const cantidad = movimientos.filter((m) => movimientoVigente(m, now)).length;
  const ordenados = [...movimientos].sort((a, b) => {
    const va = movimientoVigente(a, now);
    const vb = movimientoVigente(b, now);
    if (va !== vb) return va ? -1 : 1;
    return b.fecha - a.fecha;
  });

  async function confirmarAnular() {
    if (!anularTarget || anularBusy) return;
    setAnularBusy(true);
    try {
      await anularMovimiento(anularTarget.id, anularMotivo.trim());
      setAnularTarget(null);
      setAnularMotivo("");
      recargar();
    } catch (e) {
      console.error("[gastos] anular:", e);
    } finally {
      setAnularBusy(false);
    }
  }

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
          {/* Resumen */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
                {cantidad}
              </p>
            </div>
          </div>

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

          {/* Lista de gastos */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold uppercase text-white">
              {t("adminGastos.list")}
            </h2>
            {ordenados.length === 0 ? (
              <p className="mt-2 text-silver-400">{t("adminGastos.empty")}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-silver-400">
                    <tr>
                      <th className="px-4 py-3">{t("adminGastos.colConcept")}</th>
                      <th className="px-4 py-3">
                        {t("adminGastos.colCategory")}
                      </th>
                      <th className="px-4 py-3">{t("adminGastos.colDate")}</th>
                      <th className="px-4 py-3">
                        {t("adminGastos.colRecurrence")}
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
                    {ordenados.map((m) => {
                      const vigente = movimientoVigente(m, now);
                      return (
                        <tr key={m.id} className={vigente ? "" : "opacity-45"}>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-2 text-silver-100">
                              <span className="truncate">{m.concepto}</span>
                              {!vigente && (
                                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-silver-400">
                                  {t("adminGastos.statusVoid")}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-silver-300">
                            {t(`adminGastos.categoria.${m.categoria}`)}
                          </td>
                          <td className="px-4 py-3 text-silver-400">
                            {fechaCorta(m.fecha, locale)}
                          </td>
                          <td className="px-4 py-3 text-silver-400">
                            {t(`adminGastos.recurrencia.${m.recurrencia}`)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                            {formatCOP(m.monto)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {vigente && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAnularTarget(m);
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
        </>
      )}

      <AddMovimientoModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false);
          recargar();
        }}
      />

      {/* Confirmación de anulación */}
      <GlassModal
        open={anularTarget !== null}
        onClose={() => !anularBusy && setAnularTarget(null)}
        title={t("adminGastos.voidModal.title")}
        className="max-w-md"
      >
        <p className="text-sm text-silver-300">
          {t("adminGastos.voidModal.message", {
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
            {t("adminGastos.voidModal.confirm")}
          </GlassButton>
        </div>
      </GlassModal>
    </main>
  );
}
