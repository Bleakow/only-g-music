"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GlassButton } from "@/components/ui/GlassButton";
import { ShareIcon, SpinnerIcon } from "@/components/icons";
import { formatCOP } from "@/domain/service";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import { listAllBookings } from "@/features/booking/lib/booking-repo";
import { listTransactions } from "../lib/transactions-repo";
import { listMovimientos } from "../lib/movimientos-repo";
import { listActivos } from "../lib/activos-repo";
import { listPasivos } from "../lib/pasivos-repo";
import { reservasATransacciones, ordenarTransacciones } from "../lib/finanzas";
import type { Transaccion } from "@/domain/transaccion";
import type {
  Movimiento,
  GastoCategoria,
  ActivoCategoria,
  PasivoCategoria,
} from "@/domain/contabilidad";
import type {
  ContabilidadData,
  ContabilidadLabels,
} from "../lib/contabilidad-report";
import { AdminPagos } from "./AdminPagos";
import { AdminGastos } from "./AdminGastos";
import { AdminBienes } from "./AdminBienes";
import { AdminBalance } from "./AdminBalance";
import { EstadoResultados } from "./EstadoResultados";

type TabKey = "resultados" | "pagos" | "gastos" | "bienes" | "balance";
const TABS: TabKey[] = ["resultados", "pagos", "gastos", "bienes", "balance"];

/**
 * Área de CONTABILIDAD: una sola ventana con todo lo contable en pestañas
 * (Estado de Resultados, Pagos, Gastos, Bienes, Balance), más acciones de
 * Compartir / Descargar PDF / Descargar Excel del informe completo. La vista
 * rápida "Finanzas" queda aparte. Reusa los componentes existentes (embedded).
 */
export function AdminContabilidad() {
  const t = useTranslations();
  const locale = useLocale();
  const [tab, setTab] = useState<TabKey>("resultados");
  const [now] = useState(() => Date.now());

  // Datos cargados una vez para el INFORME (export) y la pestaña de resultados.
  // Las demás pestañas (sus componentes) cargan sus propios datos.
  const [data, setData] = useState<ContabilidadData | null>(null);
  const [txs, setTxs] = useState<Transaccion[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [busy, setBusy] = useState<null | "pdf" | "xlsx" | "share">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      listAllBookings(),
      listTransactions(),
      listMovimientos(),
      listActivos(),
      listPasivos(),
    ])
      .then(([bookings, transactions, movimientos, activos, pasivos]) => {
        if (!active) return;
        const transacciones = ordenarTransacciones([
          ...reservasATransacciones(bookings),
          ...transactions,
        ]);
        setTxs(transacciones);
        setMovs(movimientos);
        setData({ activos, pasivos, movimientos, transacciones, ahora: now });
      })
      .catch((e) => {
        if (!active) return;
        console.error("[contabilidad] load:", e);
        setError(t("adminContabilidad.loadError"));
      });
    return () => {
      active = false;
    };
  }, [t, now]);

  function labels(): ContabilidadLabels {
    return {
      title: t("adminContabilidad.export.title"),
      generado: t("adminContabilidad.export.generated", {
        date: fechaCorta(now, locale),
      }),
      resultados: t("adminContabilidad.tabs.resultados"),
      ingresos: t("adminContabilidad.export.income"),
      gastos: t("adminContabilidad.export.expenses"),
      utilidad: t("adminContabilidad.export.profit"),
      margen: t("adminContabilidad.export.margin"),
      seccionGastos: t("adminContabilidad.tabs.gastos"),
      seccionBienes: t("adminContabilidad.tabs.bienes"),
      seccionPasivos: t("adminBalance.liabilities"),
      patrimonio: t("adminBalance.equity"),
      colFecha: t("adminGastos.colDate"),
      colConcepto: t("adminBalance.colConcept"),
      colCategoria: t("adminBalance.colCategory"),
      colMonto: t("adminGastos.colAmount"),
      colValor: t("adminBalance.colValue"),
      total: t("adminContabilidad.export.total"),
      gastoCat: (c: GastoCategoria) => t(`adminGastos.categoria.${c}`),
      activoCat: (c: ActivoCategoria) => t(`adminBienes.categoria.${c}`),
      pasivoCat: (c: PasivoCategoria) => t(`adminBalance.categoria.${c}`),
      money: (n: number) => formatCOP(n),
      date: (ms: number) => fechaCorta(ms, locale),
    };
  }

  function descargar(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function descargarPDF() {
    if (!data) return;
    setBusy("pdf");
    setError(null);
    try {
      const { buildContabilidadPDF } =
        await import("../lib/contabilidad-report");
      descargar(buildContabilidadPDF(data, labels()), "contabilidad.pdf");
    } catch (e) {
      console.error("[contabilidad] pdf:", e);
      setError(t("adminContabilidad.exportError"));
    } finally {
      setBusy(null);
    }
  }

  async function descargarExcel() {
    if (!data) return;
    setBusy("xlsx");
    setError(null);
    try {
      const { buildContabilidadXLSX } =
        await import("../lib/contabilidad-report");
      descargar(
        await buildContabilidadXLSX(data, labels()),
        "contabilidad.xlsx",
      );
    } catch (e) {
      console.error("[contabilidad] xlsx:", e);
      setError(t("adminContabilidad.exportError"));
    } finally {
      setBusy(null);
    }
  }

  async function compartir() {
    if (!data) return;
    setBusy("share");
    setError(null);
    try {
      const { buildContabilidadPDF } =
        await import("../lib/contabilidad-report");
      const blob = buildContabilidadPDF(data, labels());
      const file = new File([blob], "contabilidad.pdf", {
        type: "application/pdf",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t("adminContabilidad.export.title"),
        });
      } else {
        descargar(blob, "contabilidad.pdf"); // sin Web Share → descarga
      }
    } catch (e) {
      // Cancelar el diálogo de compartir no es un error.
      if ((e as Error)?.name !== "AbortError") {
        console.error("[contabilidad] share:", e);
        setError(t("adminContabilidad.exportError"));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 pt-28 pb-24 sm:px-12">
      <Link
        href="/admin"
        className="text-silver-300 text-sm underline-offset-4 hover:text-white hover:underline"
      >
        {t("adminContabilidad.backToAdmin")}
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-narrow text-5xl font-bold uppercase sm:text-6xl">
            {t("adminContabilidad.title")}
          </h1>
          <p className="text-silver-300 mt-2 max-w-xl">
            {t("adminContabilidad.intro")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GlassButton onClick={compartir} disabled={!data || busy !== null}>
            {busy === "share" ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : (
              <ShareIcon className="size-4" />
            )}
            {t("adminContabilidad.share")}
          </GlassButton>
          <GlassButton onClick={descargarPDF} disabled={!data || busy !== null}>
            {busy === "pdf" && <SpinnerIcon className="size-4 animate-spin" />}
            {t("adminContabilidad.downloadPdf")}
          </GlassButton>
          <GlassButton
            onClick={descargarExcel}
            disabled={!data || busy !== null}
          >
            {busy === "xlsx" && <SpinnerIcon className="size-4 animate-spin" />}
            {t("adminContabilidad.downloadExcel")}
          </GlassButton>
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* Pestañas */}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-4 py-2 text-sm font-semibold tracking-wide uppercase transition ${
              tab === k
                ? "bg-amethyst-500/20 ring-amethyst-300/50 text-white ring-1 ring-inset"
                : "text-silver-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t(`adminContabilidad.tabs.${k}`)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "resultados" && (
          <EstadoResultados txs={txs} movimientos={movs} />
        )}
        {tab === "pagos" && <AdminPagos embedded />}
        {tab === "gastos" && <AdminGastos embedded />}
        {tab === "bienes" && <AdminBienes embedded />}
        {tab === "balance" && <AdminBalance embedded />}
      </div>
    </main>
  );
}
