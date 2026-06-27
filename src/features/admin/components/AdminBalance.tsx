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
} from "@/components/icons";
import { formatCOP } from "@/domain/service";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import {
  type Activo,
  type Pasivo,
  balanceGeneral,
  pasivoVigente,
} from "@/domain/contabilidad";
import { listActivos } from "../lib/activos-repo";
import { listPasivos, saldarPasivo } from "../lib/pasivos-repo";
import {
  type BalanceExportLabels,
  balanceToCSV,
  balanceToHTML,
} from "../lib/contabilidad-export";
import { AddPasivoModal } from "./AddPasivoModal";

export function AdminBalance({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const [now] = useState(() => Date.now());

  const [activos, setActivos] = useState<Activo[]>([]);
  const [pasivos, setPasivos] = useState<Pasivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Liquidación de pasivo
  const [saldarTarget, setSaldarTarget] = useState<Pasivo | null>(null);
  const [saldarMotivo, setSaldarMotivo] = useState("");
  const [saldarBusy, setSaldarBusy] = useState(false);

  function cargar(initial = false) {
    if (!initial) setLoading(true);
    return Promise.all([listActivos(), listPasivos()])
      .then(([a, p]) => {
        setActivos(a);
        setPasivos(p);
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
    Promise.all([listActivos(), listPasivos()])
      .then(([a, p]) => {
        if (!active) return;
        setActivos(a);
        setPasivos(p);
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

  const balance = balanceGeneral(activos, pasivos, now);
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
      money: (n) => formatCOP(n),
    };
  }

  function descargarCSV() {
    const csv = balanceToCSV(activos, pasivos, balance, now, exportLabels());
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
    const html = balanceToHTML(activos, pasivos, balance, now, exportLabels());
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

  return (
    <div
      className={
        embedded ? "" : "mx-auto min-h-dvh max-w-4xl px-6 pt-28 pb-24 sm:px-12"
      }
    >
      {!embedded && (
        <Link
          href="/admin"
          className="text-silver-300 text-sm underline-offset-4 hover:text-white hover:underline"
        >
          {t("adminBalance.backToAdmin")}
        </Link>
      )}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-narrow text-5xl font-bold uppercase sm:text-6xl">
            {t("adminBalance.title")}
          </h1>
          <p className="text-silver-300 mt-2 max-w-xl">
            {t("adminBalance.intro")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-silver-300 mt-10">{t("common.loading")}</p>
      ) : (
        <>
          {/* Hoja de balance: Activos = Pasivos + Patrimonio */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-silver-400 text-xs tracking-[2px] uppercase">
                {t("adminBalance.assets")}
              </p>
              <p className="font-narrow mt-1 text-2xl font-bold text-white">
                {formatCOP(balance.activos)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-silver-400 text-xs tracking-[2px] uppercase">
                {t("adminBalance.liabilities")}
              </p>
              <p className="font-narrow mt-1 text-2xl font-bold text-white">
                {formatCOP(balance.pasivos)}
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

          {/* Pasivos */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold text-white uppercase">
              {t("adminBalance.liabilities")}
            </h2>
            {pasivosOrdenados.length === 0 ? (
              <p className="text-silver-400 mt-2">{t("adminBalance.empty")}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="text-silver-400 bg-white/[0.03] text-xs tracking-wide uppercase">
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
                  <tbody className="divide-y divide-white/5">
                    {pasivosOrdenados.map((p) => {
                      const vigente = pasivoVigente(p, now);
                      return (
                        <tr key={p.id} className={vigente ? "" : "opacity-45"}>
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
        </>
      )}

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
