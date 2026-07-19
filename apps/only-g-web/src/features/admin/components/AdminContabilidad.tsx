"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ShareIcon,
  SpinnerIcon,
  FilePdfIcon,
  FileSheetIcon,
} from "@/components/icons";
import { formatCOP } from "@only-g/shared-types/service";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import { listAllBookings } from "@/features/booking/lib/booking-repo";
import { listTransactions } from "../lib/transactions-repo";
import { listMovimientos } from "../lib/movimientos-repo";
import { listActivos } from "../lib/activos-repo";
import { listPasivos } from "../lib/pasivos-repo";
import { listPayouts } from "../lib/payouts-repo";
import {
  reservasATransacciones,
  netoProductorPorReserva,
  ordenarTransacciones,
} from "../lib/finanzas";
import type { Transaccion } from "@only-g/shared-types/transaccion";
import {
  type Movimiento,
  type GastoCategoria,
  type ActivoCategoria,
  type PasivoCategoria,
  type Periodo,
  estadoResultados,
  periodoMes,
  periodoAnio,
  PERIODO_TODO,
} from "@only-g/shared-types/contabilidad";
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

type PeriodoKey = "mes" | "anio" | "todo";
const PERIODOS: PeriodoKey[] = ["mes", "anio", "todo"];

/** "2026-06" → "Junio 2026" (primera letra en mayúscula para es). */
function mesAnioLabel(ym: string, locale: string): string {
  const [y, m] = ym.split("-").map(Number);
  const s = new Date(y, (m || 1) - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

  // Periodo del informe (mensual / anual / histórico completo).
  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>("todo");
  const [ym, setYm] = useState(() => {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [anio, setAnio] = useState(() => new Date(now).getFullYear());

  const periodo: Periodo = useMemo(() => {
    if (periodoKey === "mes") {
      const [y, m] = ym.split("-").map(Number);
      return periodoMes(y, m - 1);
    }
    if (periodoKey === "anio") return periodoAnio(anio);
    return PERIODO_TODO;
  }, [periodoKey, ym, anio]);

  const periodoValue =
    periodoKey === "mes"
      ? mesAnioLabel(ym, locale)
      : periodoKey === "anio"
        ? String(anio)
        : t("adminContabilidad.export.periodoTodo");

  const fileSuffix =
    periodoKey === "mes" ? ym : periodoKey === "anio" ? String(anio) : "historico";

  useEffect(() => {
    let active = true;
    Promise.all([
      listAllBookings(),
      listTransactions(),
      listMovimientos(),
      listActivos(),
      listPasivos(),
      listPayouts(),
    ])
      .then(
        ([bookings, transactions, movimientos, activos, pasivos, payouts]) => {
          if (!active) return;
          const transacciones = ordenarTransacciones([
            ...reservasATransacciones(
              bookings,
              netoProductorPorReserva(payouts),
            ),
            ...transactions,
          ]);
          setTxs(transacciones);
          setMovs(movimientos);
          setData({ activos, pasivos, movimientos, transacciones, ahora: now });
        },
      )
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
    // La nota del callout depende del signo de la utilidad (mismo P&L que el PDF).
    const pl = estadoResultados(txs, movs, periodo, now);
    const nota =
      pl.utilidad < 0
        ? t("adminContabilidad.export.notaNegativa", {
            monto: formatCOP(Math.abs(pl.utilidad)),
          })
        : t("adminContabilidad.export.notaPositiva", {
            monto: formatCOP(pl.utilidad),
            margen: Math.round(pl.margen * 100),
          });

    return {
      // formatters
      gastoCat: (c: GastoCategoria) => t(`adminGastos.categoria.${c}`),
      activoCat: (c: ActivoCategoria) => t(`adminBienes.categoria.${c}`),
      pasivoCat: (c: PasivoCategoria) => t(`adminBalance.categoria.${c}`),
      money: (n: number) => formatCOP(n),
      date: (ms: number) => fechaCorta(ms, locale),
      // cabecera de marca
      docTitle: t("adminContabilidad.export.docTitle"),
      brand: t("adminContabilidad.export.brand"),
      periodoLabel: t("adminContabilidad.export.periodoLabel"),
      periodoValue,
      generadoLabel: t("adminContabilidad.export.generatedLabel"),
      generadoValue: fechaCorta(now, locale),
      // secciones
      resumen: t("adminContabilidad.export.resumen"),
      vision: t("adminContabilidad.export.vision"),
      detalleGastos: t("adminContabilidad.export.detalleGastos"),
      seccionBienes: t("adminContabilidad.export.bienes"),
      seccionPasivos: t("adminBalance.liabilities"),
      patrimonioNeto: t("adminContabilidad.export.patrimonioNeto"),
      // stats + columnas
      ingresos: t("adminContabilidad.export.income"),
      gastos: t("adminContabilidad.export.expenses"),
      utilidad: t("adminContabilidad.export.profit"),
      margen: t("adminContabilidad.export.margin"),
      colFecha: t("adminGastos.colDate"),
      colConcepto: t("adminBalance.colConcept"),
      colCategoria: t("adminBalance.colCategory"),
      colMonto: t("adminGastos.colAmount"),
      colValor: t("adminBalance.colValue"),
      total: t("adminContabilidad.export.total"),
      totalActivos: t("adminBalance.totalAssets"),
      totalPasivos: t("adminBalance.totalLiabilities"),
      // textos / estados
      nota,
      sinGastos: t("adminContabilidad.export.sinGastos"),
      sinBienes: t("adminContabilidad.export.sinBienes"),
      sinPasivos: t("adminContabilidad.export.sinPasivos"),
      footerCopy: t("adminContabilidad.export.footerCopy", {
        year: new Date(now).getFullYear(),
      }),
      footerNote: t("adminContabilidad.export.footerNote"),
      // --- compat XLSX ---
      title: t("adminContabilidad.export.title"),
      generado: t("adminContabilidad.export.generated", {
        date: fechaCorta(now, locale),
      }),
      resultados: t("adminContabilidad.tabs.resultados"),
      seccionGastos: t("adminContabilidad.tabs.gastos"),
      patrimonio: t("adminBalance.equity"),
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
      descargar(
        await buildContabilidadPDF(data, labels(), periodo),
        `contabilidad-${fileSuffix}.pdf`,
      );
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
        await buildContabilidadXLSX(data, labels(), periodo),
        `contabilidad-${fileSuffix}.xlsx`,
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
      const blob = await buildContabilidadPDF(data, labels(), periodo);
      const file = new File([blob], `contabilidad-${fileSuffix}.pdf`, {
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

        {/* Periodo del informe: mensual / anual / histórico. Afecta al PDF y al Excel. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-silver-400 mr-1 text-xs tracking-[1.5px] uppercase">
            {t("adminContabilidad.periodLabel")}
          </span>
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
              {t(`adminContabilidad.periodo.${k}`)}
            </button>
          ))}
          {periodoKey === "mes" && (
            <input
              type="month"
              value={ym}
              onChange={(e) => setYm(e.target.value)}
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white ring-1 ring-white/20 transition outline-none ring-inset focus:ring-white/50 [color-scheme:dark]"
            />
          )}
          {periodoKey === "anio" && (
            <input
              type="number"
              min={2020}
              max={2100}
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="w-24 rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white ring-1 ring-white/20 transition outline-none ring-inset focus:ring-white/50"
            />
          )}
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
