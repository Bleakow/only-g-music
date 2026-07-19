/**
 * Contratos entre los BUILDERS (que calculan con el dominio y formatean) y los
 * DOCUMENTOS react-pdf (puramente presentacionales). Los modelos ya vienen con
 * todo formateado a string salvo los pocos números que el gráfico necesita para
 * escalar barras. Así los .tsx de PDF no importan dominio ni i18n.
 */
import type {
  GastoCategoria,
  ActivoCategoria,
  PasivoCategoria,
} from "@only-g/shared-types/contabilidad";

// ───────────────────────── Informe Contable ─────────────────────────

/** Etiquetas del Informe: formatters (para construir el modelo) + textos fijos.
 *  Superset: también cubre lo que necesita el export a Excel (compat). */
export interface ContabilidadLabels {
  // formatters (los usa el builder para armar el modelo y el XLSX)
  money: (n: number) => string;
  date: (ms: number) => string;
  gastoCat: (c: GastoCategoria) => string;
  activoCat: (c: ActivoCategoria) => string;
  pasivoCat: (c: PasivoCategoria) => string;
  // cabecera de marca
  docTitle: string;
  brand: string;
  periodoLabel: string;
  periodoValue: string;
  generadoLabel: string;
  generadoValue: string;
  // títulos de sección
  resumen: string;
  vision: string;
  detalleGastos: string;
  seccionBienes: string;
  seccionPasivos: string;
  patrimonioNeto: string;
  // stats + columnas
  ingresos: string;
  gastos: string;
  utilidad: string;
  margen: string;
  colFecha: string;
  colConcepto: string;
  colCategoria: string;
  colMonto: string;
  colValor: string;
  total: string;
  totalActivos: string;
  totalPasivos: string;
  // textos / estados
  nota: string;
  sinGastos: string;
  sinBienes: string;
  sinPasivos: string;
  footerCopy: string;
  footerNote: string;
  // --- solo XLSX (compat con el export a Excel) ---
  title: string;
  generado: string;
  resultados: string;
  seccionGastos: string;
  patrimonio: string;
}

export interface ContabilidadModel {
  ingresos: string;
  gastos: string;
  utilidad: { value: string; negative: boolean };
  margen: { value: string; negative: boolean };
  chart: {
    ingresos: number;
    gastos: number;
    ingresosDisplay: string;
    gastosDisplay: string;
    maxDisplay: string;
  };
  /** Filas [fecha, concepto, categoría, monto] ya formateadas. */
  gastosRows: string[][];
  gastosTotal: string;
  /** Filas [concepto, categoría, valor]. */
  bienesRows: string[][];
  bienesTotal: string;
  pasivosRows: string[][];
  pasivosTotal: string;
  patrimonio: string;
}

// ───────────────────────── Balance General ─────────────────────────

export interface BalanceLabels {
  docTitle: string;
  brand: string;
  generadoLabel: string;
  generadoValue: string;
  resumen: string;
  seccionActivos: string;
  seccionPasivos: string;
  patrimonioNeto: string;
  colConcepto: string;
  colCategoria: string;
  colValor: string;
  assets: string;
  liabilities: string;
  totalActivos: string;
  totalPasivos: string;
  ecuacion: string;
  sinActivos: string;
  sinPasivos: string;
  footerCopy: string;
  footerNote: string;
}

export interface BalanceModel {
  assets: string; // total activos formateado (stat card)
  liabilities: string; // total pasivos formateado (stat card)
  patrimonio: string; // formateado
  patrimonioNegative: boolean;
  /** Filas [concepto, categoría, valor] ya formateadas. */
  activosRows: string[][];
  pasivosRows: string[][];
  totalActivos: string;
  totalPasivos: string;
}
