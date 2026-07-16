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
} from "@/components/icons";
import { formatCOP } from "@only-g/shared-types/service";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import {
  type Activo,
  type Pasivo,
  balanceGeneral,
  pasivoVigente,
} from "@only-g/shared-types/contabilidad";
import { type Payout, totalPayoutsPendientes } from "@only-g/shared-types/payout";
import type { BeatSale } from "@only-g/shared-types/beat-sale";
import { listActivos } from "../lib/activos-repo";
import { listPasivos, saldarPasivo } from "../lib/pasivos-repo";
import { listPayouts, backfillPayouts } from "../lib/payouts-repo";
import { listBeatSales } from "@/features/beats/lib/beat-sales-repo";
import {
  type BalanceExportLabels,
  type PayoutExportRow,
  balanceToCSV,
  balanceToHTML,
} from "../lib/contabilidad-export";
import { AddPasivoModal } from "./AddPasivoModal";
import { AdminPageHeader, adminCard, adminInner } from "./admin-ui";
import { Skeleton } from "@/components/ui/Skeleton";

export function AdminBalance({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const [now] = useState(() => Date.now());

  const [activos, setActivos] = useState<Activo[]>([]);
  const [pasivos, setPasivos] = useState<Pasivo[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [beatSales, setBeatSales] = useState<BeatSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Liquidación de pasivo
  const [saldarTarget, setSaldarTarget] = useState<Pasivo | null>(null);
  const [saldarMotivo, setSaldarMotivo] = useState("");
  const [saldarBusy, setSaldarBusy] = useState(false);

  function cargar(initial = false) {
    if (!initial) setLoading(true);
    return Promise.all([
      listActivos(),
      listPasivos(),
      listPayouts(),
      listBeatSales(),
    ])
      .then(([a, p, po, bs]) => {
        setActivos(a);
        setPasivos(p);
        setPayouts(po);
        setBeatSales(bs);
        setError(null);
      })
      .catch((e) => {
        console.error("[balance] load:", e);
        setError(t("adminBalance.loadError"));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    Promise.all([listActivos(), listPasivos(), listPayouts(), listBeatSales()])
      .then(([a, p, po, bs]) => {
        if (!active) return;
        setActivos(a);
        setPasivos(p);
        setPayouts(po);
        setBeatSales(bs);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[balance] load:", e);
        setError(t("adminBalance.loadError"));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [t]);

  // Deuda a socios = payouts pendientes + ventas de beat impagas que AÚN no
  // tienen payout (histórico anterior a la Fase 2, sin materializar). RECONCILIAR
  // así hace que el Balance sea correcto de inmediato: sin esto subestimaría la
  // deuda y sobreestimaría el patrimonio hasta correr el backfill, y discreparía
  // del panel de payouts de beats. El backfill solo MATERIALIZA esos payouts para
  // que aparezcan por-persona (no cambia el total, que ya está reconciliado).
  const payoutIds = new Set(payouts.map((p) => p.id));
  const ventasSinPayout = beatSales.filter(
    (bs) => !bs.paidOut && bs.beatmakerUid && !payoutIds.has(`beat_${bs.id}`),
  );
  const netosHuerfanos = ventasSinPayout.reduce((s, bs) => s + bs.neto, 0);
  const payoutsPendientes = payouts.filter((p) => p.estado === "pendiente");
  const totalPayouts = totalPayoutsPendientes(payouts) + netosHuerfanos;
  const balance = balanceGeneral(activos, pasivos, now, totalPayouts);

  async function sincronizar() {
    setSyncing(true);
    try {
      await backfillPayouts();
      await cargar();
    } catch (e) {
      console.error("[balance] sync:", e);
      setError(t("adminBalance.payouts.syncError"));
    } finally {
      setSyncing(false);
    }
  }
  const positivo = balance.patrimonio >= 0;
  const pasivosOrdenados = [...pasivos].sort((a, b) => {
    const va = pasivoVigente(a, now);
    const vb = pasivoVigente(b, now);
    if (va !== vb) return va ? -1 : 1;
    return b.fecha - a.fecha;
  });

  function exportLabels(): BalanceExportLabels {
    return {
      title: t("adminBalance.export.title"),
      generado: t("adminBalance.export.generated", {
        date: fechaCorta(now, locale),
      }),
      seccionActivos: t("adminBalance.assets"),
      seccionPasivos: t("adminBalance.liabilities"),
      totalActivos: t("adminBalance.totalAssets"),
      totalPasivos: t("adminBalance.totalLiabilities"),
      patrimonio: t("adminBalance.equity"),
      ecuacion: t("adminBalance.equation"),
      colConcepto: t("adminBalance.colConcept"),
      colCategoria: t("adminBalance.colCategory"),
      colValor: t("adminBalance.colValue"),
      activoCat: (c) => t(`adminBienes.categoria.${c}`),
      pasivoCat: (c) => t(`adminBalance.categoria.${c}`),
      payoutCat: t("adminBalance.payouts.category"),
      money: (n) => formatCOP(n),
    };
  }

  /** Payouts pendientes como filas de export (dentro de la sección de pasivos). */
  function payoutExportRows(): PayoutExportRow[] {
    return payoutsPendientes.map((p) => ({
      concepto: p.acreedorNombre ?? p.acreedorUid,
      monto: p.monto,
    }));
  }

  function descargarCSV() {
    const csv = balanceToCSV(
      activos,
      pasivos,
      balance,
      now,
      exportLabels(),
      payoutExportRows(),
    );
    // BOM para que Excel respete los acentos (UTF-8).
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "balance-general.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function imprimirPDF() {
    const html = balanceToHTML(
      activos,
      pasivos,
      balance,
      now,
      exportLabels(),
      payoutExportRows(),
    );
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  async function confirmarSaldar() {
    if (!saldarTarget || saldarBusy) return;
    setSaldarBusy(true);
    try {
      await saldarPasivo(saldarTarget.id, saldarMotivo.trim());
      setSaldarTarget(null);
      setSaldarMotivo("");
      cargar();
    } catch (e) {
      console.error("[balance] saldar:", e);
    } finally {
      setSaldarBusy(false);
    }
  }

  const actions = (
    <>
      <GlassButton
        onClick={() => setShowAdd(true)}
        className="!text-amethyst-200"
      >
        <PlusIcon className="size-4" />
        {t("adminBalance.addButton")}
      </GlassButton>
      <GlassButton onClick={descargarCSV} disabled={loading}>
        {t("adminBalance.exportCsv")}
      </GlassButton>
      <GlassButton onClick={imprimirPDF} disabled={loading}>
        {t("adminBalance.exportPdf")}
      </GlassButton>
    </>
  );

  return (
    <div className={embedded ? "" : "pb-24"}>
      {embedded ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-narrow text-3xl font-bold uppercase sm:text-4xl">
              {t("adminBalance.title")}
            </h2>
            <p className="text-silver-300 mt-2 max-w-xl text-sm">
              {t("adminBalance.intro")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      ) : (
        <AdminPageHeader
          eyebrow={t("adminDashboard.eyebrow")}
          title={t("adminBalance.title")}
          subtitle={t("adminBalance.intro")}
        >
          <div className="mt-6 flex flex-wrap gap-2">{actions}</div>
        </AdminPageHeader>
      )}

      <div className={embedded ? "" : "px-6 sm:px-10"}>
        {error && (
          <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {loading ? (
          <>
            {/* Hoja de balance (skeleton) */}
            <div className={`mt-8 ${adminCard} p-5`}>
              <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`rounded-2xl p-5 ${adminInner}`}>
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-2 h-7 w-32" />
                  </div>
                ))}
              </div>
              <Skeleton className="mx-auto mt-3 h-4 w-64" />
            </div>

            {/* Pasivos (skeleton) */}
            <section className={`mt-10 ${adminCard} p-5`}>
              <Skeleton className="h-6 w-40" />
              <div className={`mt-4 overflow-hidden rounded-xl ${adminInner}`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/5" />
                    <Skeleton className="ml-auto h-4 w-24" />
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Hoja de balance: Activos = Pasivos + Patrimonio */}
            <div className={`mt-8 ${adminCard} p-5`}>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className={`rounded-2xl p-5 ${adminInner}`}>
                  <p className="text-silver-400 text-xs tracking-[2px] uppercase">
                    {t("adminBalance.assets")}
                  </p>
                  <p className="font-narrow mt-1 text-2xl font-bold text-white">
                    {formatCOP(balance.activos)}
                  </p>
                </div>
                <div className={`rounded-2xl p-5 ${adminInner}`}>
                  <p className="text-silver-400 text-xs tracking-[2px] uppercase">
                    {t("adminBalance.liabilities")}
                  </p>
                  <p className="font-narrow mt-1 text-2xl font-bold text-white">
                    {formatCOP(balance.pasivos)}
                  </p>
                </div>
                <div
                  className={`rounded-2xl p-5 ring-1 backdrop-blur-md ring-inset ${
                    positivo
                      ? "bg-emerald-500/10 ring-emerald-300/30"
                      : "bg-red-500/10 ring-red-300/30"
                  }`}
                >
                  <p
                    className={`text-xs tracking-[2px] uppercase ${
                      positivo ? "text-emerald-200" : "text-red-200"
                    }`}
                  >
                    {t("adminBalance.equity")}
                  </p>
                  <p className="font-narrow mt-1 text-2xl font-bold text-white">
                    {formatCOP(balance.patrimonio)}
                  </p>
                </div>
              </div>
              <p className="text-silver-400 mt-3 text-center text-sm">
                {t("adminBalance.equation")}
              </p>
            </div>

            {/* Pasivos */}
            <section className={`mt-10 ${adminCard} p-5`}>
              <h2 className="font-narrow text-2xl font-bold text-white uppercase">
                {t("adminBalance.liabilities")}
              </h2>
              {pasivosOrdenados.length === 0 ? (
                <p className="text-silver-400 mt-2">
                  {t("adminBalance.empty")}
                </p>
              ) : (
                <div
                  className={`mt-4 overflow-x-auto rounded-xl ${adminInner}`}
                >
                  <table className="w-full min-w-[44rem] text-left text-sm">
                    <thead className="text-silver-400 text-xs tracking-wide uppercase">
                      <tr>
                        <th className="px-4 py-3">
                          {t("adminBalance.colConcept")}
                        </th>
                        <th className="px-4 py-3">
                          {t("adminBalance.colCategory")}
                        </th>
                        <th className="px-4 py-3">
                          {t("adminBalance.colCreditor")}
                        </th>
                        <th className="px-4 py-3">
                          {t("adminBalance.colDueDate")}
                        </th>
                        <th className="px-4 py-3 text-right">
                          {t("adminBalance.colValue")}
                        </th>
                        <th className="px-4 py-3 text-right">
                          {t("adminBalance.colActions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {pasivosOrdenados.map((p) => {
                        const vigente = pasivoVigente(p, now);
                        return (
                          <tr
                            key={p.id}
                            className={vigente ? "" : "opacity-45"}
                          >
                            <td className="px-4 py-3">
                              <span className="text-silver-100 flex items-center gap-2">
                                <span className="truncate">{p.nombre}</span>
                                {!vigente && (
                                  <span className="text-silver-400 shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] tracking-wide uppercase">
                                    {t("adminBalance.statusSettled")}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="text-silver-300 px-4 py-3">
                              {t(`adminBalance.categoria.${p.categoria}`)}
                            </td>
                            <td className="text-silver-400 px-4 py-3">
                              {p.acreedor ?? "—"}
                            </td>
                            <td className="text-silver-400 px-4 py-3">
                              {p.vencimiento
                                ? fechaCorta(p.vencimiento, locale)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">
                              {formatCOP(p.monto)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {vigente && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSaldarTarget(p);
                                    setSaldarMotivo("");
                                  }}
                                  aria-label={t("adminBalance.settle")}
                                  className="text-silver-400 inline-flex size-8 items-center justify-center rounded-full transition hover:bg-emerald-500/10 hover:text-emerald-300"
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

            {/* Payouts a socios (pendientes): cuenta por pagar VISIBLE, ya
                sumada al total de pasivos de arriba. Solo lectura: la
                liquidación vive en «Ventas y pagos de beats». */}
            {(payoutsPendientes.length > 0 || ventasSinPayout.length > 0) && (
              <section className={`mt-10 ${adminCard} p-5`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-narrow text-2xl font-bold text-white uppercase">
                    {t("adminBalance.payouts.title")}
                  </h2>
                  <p className="text-amethyst-200 text-sm font-semibold">
                    {t("adminBalance.payouts.total", {
                      monto: formatCOP(totalPayouts),
                    })}
                  </p>
                </div>
                <p className="text-silver-400 mt-1 max-w-xl text-sm">
                  {t("adminBalance.payouts.intro")}
                </p>

                {/* Ventas impagas anteriores a la Fase 2 sin payout materializado:
                    YA están sumadas al total (reconciliación), pero no aparecen en
                    la tabla por-persona hasta sincronizarlas. */}
                {ventasSinPayout.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
                    <p className="text-sm text-amber-200">
                      {t("adminBalance.payouts.sinSincronizar", {
                        n: ventasSinPayout.length,
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={sincronizar}
                      disabled={syncing}
                      className="border-amber-300/40 text-amber-100 hover:bg-amber-400/10 flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs tracking-[1px] uppercase transition disabled:opacity-50"
                    >
                      {syncing && (
                        <SpinnerIcon className="size-3.5 animate-spin" />
                      )}
                      {t("adminBalance.payouts.sincronizar")}
                    </button>
                  </div>
                )}
                <div className={`mt-4 overflow-x-auto rounded-xl ${adminInner}`}>
                  <table className="w-full min-w-xl text-left text-sm">
                    <thead className="text-silver-400 text-xs tracking-wide uppercase">
                      <tr>
                        <th className="px-4 py-3">
                          {t("adminBalance.colCreditor")}
                        </th>
                        <th className="px-4 py-3">
                          {t("adminBalance.payouts.colOrigin")}
                        </th>
                        <th className="px-4 py-3">
                          {t("adminBalance.payouts.colDate")}
                        </th>
                        <th className="px-4 py-3 text-right">
                          {t("adminBalance.colValue")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {payoutsPendientes.map((p) => (
                        <tr key={p.id}>
                          <td className="text-silver-100 px-4 py-3">
                            {p.acreedorNombre ?? p.acreedorUid}
                          </td>
                          <td className="text-silver-300 px-4 py-3">
                            {t(`adminBalance.payouts.origen.${p.origen}`)}
                          </td>
                          <td className="text-silver-400 px-4 py-3">
                            {fechaCorta(p.createdAt, locale)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">
                            {formatCOP(p.monto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <AddPasivoModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false);
          cargar();
        }}
      />

      {/* Confirmación de liquidación */}
      <GlassModal
        open={saldarTarget !== null}
        onClose={() => !saldarBusy && setSaldarTarget(null)}
        title={t("adminBalance.settleModal.title")}
        className="max-w-md"
      >
        <p className="text-silver-300 text-sm">
          {t("adminBalance.settleModal.message", {
            name: saldarTarget?.nombre ?? "",
          })}
        </p>
        <input
          value={saldarMotivo}
          onChange={(e) => setSaldarMotivo(e.target.value)}
          placeholder={t("adminBalance.settleModal.reasonPlaceholder")}
          className="mt-4 w-full rounded-lg bg-white/[0.06] px-3 py-2 text-white ring-1 ring-white/20 transition outline-none ring-inset placeholder:text-white/40 focus:ring-white/50"
        />
        <div className="mt-5 flex items-center justify-end gap-3">
          <GlassButton
            onClick={() => setSaldarTarget(null)}
            disabled={saldarBusy}
          >
            {t("adminBalance.settleModal.cancel")}
          </GlassButton>
          <GlassButton
            onClick={confirmarSaldar}
            disabled={saldarBusy}
            className="!text-emerald-300"
          >
            {saldarBusy ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
            {t("adminBalance.settleModal.confirm")}
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}
