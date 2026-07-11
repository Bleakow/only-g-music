"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ShareIcon,
  SpinnerIcon,
  FilePdfIcon,
  FileSheetIcon,
} from "@/components/icons";
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
import { AdminPageHeader } from "./admin-ui";

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
    <main className="pb-24">
      <AdminPageHeader
        eyebrow={t("adminDashboard.eyebrow")}
        title={t("adminContabilidad.title")}
        subtitle={t("adminContabilidad.intro")}
      >
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <ExportButton
            onClick={compartir}
            disabled={!data || busy !== null}
            busy={busy === "share"}
            accent="amethyst"
            label={t("adminContabilidad.share")}
          >
            <ShareIcon className="size-5" />
          </ExportButton>
          <ExportButton
            onClick={descargarPDF}
            disabled={!data || busy !== null}
            busy={busy === "pdf"}
            accent="red"
            label={t("adminContabilidad.downloadPdf")}
          >
            <FilePdfIcon className="size-5" />
          </ExportButton>
          <ExportButton
            onClick={descargarExcel}
            disabled={!data || busy !== null}
            busy={busy === "xlsx"}
            accent="emerald"
            label={t("adminContabilidad.downloadExcel")}
          >
            <FileSheetIcon className="size-5" />
          </ExportButton>
        </div>
      </AdminPageHeader>

      <div className="px-6 sm:px-10">
        {error && (
          <p className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {/* Pestañas */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
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
      </div>
    </main>
  );
}

const EXPORT_ACCENTS = {
  amethyst:
    "[&_svg]:text-amethyst-300 hover:border-amethyst-300/50 hover:bg-amethyst-500/15",
  red: "[&_svg]:text-red-300 hover:border-red-400/50 hover:bg-red-500/15",
  emerald:
    "[&_svg]:text-emerald-300 hover:border-emerald-400/50 hover:bg-emerald-500/15",
} as const;

/** Botón de exportación compacto: icono con color de marca (PDF rojo, Excel
 *  verde, compartir amatista) + etiqueta, con leve elevación al hover. Sustituye
 *  al GlassButton genérico grande. */
function ExportButton({
  onClick,
  disabled,
  busy,
  accent,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  accent: keyof typeof EXPORT_ACCENTS;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group text-silver-100 flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-md transition hover:-translate-y-0.5 hover:text-white disabled:pointer-events-none disabled:opacity-40 ${EXPORT_ACCENTS[accent]}`}
    >
      {busy ? <SpinnerIcon className="size-5 animate-spin" /> : children}
      <span>{label}</span>
    </button>
  );
}
