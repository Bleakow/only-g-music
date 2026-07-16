/**
 * Informe contable COMPLETO → PDF (jsPDF + autotable) y Excel (ExcelJS). Toma los
 * datos crudos ya cargados y calcula con el dominio (P&L, balance, etc.). Pesa
 * bastante (jsPDF/ExcelJS), así que se importa EN DIFERIDO desde el componente.
 * Las etiquetas llegan traducidas (i18n) para no acoplar el dominio a next-intl.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import {
  type Activo,
  type Pasivo,
  type Movimiento,
  type ActivoCategoria,
  type GastoCategoria,
  type PasivoCategoria,
  balanceGeneral,
  estadoResultados,
  expandirGastos,
  cuentaEnPnl,
  activoVigente,
  pasivoVigente,
  valorEnLibros,
  PERIODO_TODO,
} from "@only-g/shared-types/contabilidad";
import type { Transaccion } from "@only-g/shared-types/transaccion";

export interface ContabilidadData {
  activos: Activo[];
  pasivos: Pasivo[];
  movimientos: Movimiento[];
  transacciones: Transaccion[];
  ahora: number;
}

export interface ContabilidadLabels {
  title: string;
  generado: string;
  resultados: string;
  ingresos: string;
  gastos: string;
  utilidad: string;
  margen: string;
  seccionGastos: string;
  seccionBienes: string;
  seccionPasivos: string;
  patrimonio: string;
  colFecha: string;
  colConcepto: string;
  colCategoria: string;
  colMonto: string;
  colValor: string;
  total: string;
  gastoCat: (c: GastoCategoria) => string;
  activoCat: (c: ActivoCategoria) => string;
  pasivoCat: (c: PasivoCategoria) => string;
  money: (n: number) => string;
  date: (ms: number) => string;
}

const ACCENT: [number, number, number] = [124, 58, 237];

type DocConTabla = jsPDF & { lastAutoTable: { finalY: number } };

function computar(d: ContabilidadData) {
  return {
    balance: balanceGeneral(d.activos, d.pasivos, d.ahora),
    pl: estadoResultados(d.transacciones, d.movimientos, PERIODO_TODO, d.ahora),
    gastos: expandirGastos(d.movimientos, PERIODO_TODO, d.ahora).filter(
      cuentaEnPnl,
    ),
    bienes: d.activos.filter((a) => activoVigente(a, d.ahora)),
    pasivos: d.pasivos.filter((p) => pasivoVigente(p, d.ahora)),
  };
}

/** Informe contable → PDF (Blob). Secciones: P&L, Gastos, Bienes, Pasivos. */
export function buildContabilidadPDF(
  d: ContabilidadData,
  L: ContabilidadLabels,
): Blob {
  const { balance, pl, gastos, bienes, pasivos } = computar(d);
  const doc = new jsPDF() as DocConTabla;

  doc.setFontSize(18);
  doc.text(L.title, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(L.generado, 14, 24);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 32,
    head: [[L.resultados, ""]],
    body: [
      [L.ingresos, L.money(pl.ingresos)],
      [L.gastos, L.money(pl.gastos)],
      [L.utilidad, L.money(pl.utilidad)],
      [L.margen, `${Math.round(pl.margen * 100)}%`],
    ],
    theme: "grid",
    headStyles: { fillColor: ACCENT },
    columnStyles: { 1: { halign: "right" } },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [[L.colFecha, L.colConcepto, L.colCategoria, L.colMonto]],
    body: gastos.map((g) => [
      L.date(g.fecha),
      g.concepto,
      L.gastoCat(g.categoria),
      L.money(g.monto),
    ]),
    foot: [[L.total, "", "", L.money(pl.gastos)]],
    theme: "striped",
    headStyles: { fillColor: ACCENT },
    footStyles: { fillColor: [30, 30, 40], textColor: 255 },
    columnStyles: { 3: { halign: "right" } },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [[L.seccionBienes, L.colCategoria, L.colValor]],
    body: bienes.map((a) => [
      a.nombre,
      L.activoCat(a.categoria),
      L.money(valorEnLibros(a, d.ahora)),
    ]),
    foot: [[L.total, "", L.money(balance.activos)]],
    theme: "striped",
    headStyles: { fillColor: ACCENT },
    footStyles: { fillColor: [30, 30, 40], textColor: 255 },
    columnStyles: { 2: { halign: "right" } },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [[L.seccionPasivos, L.colCategoria, L.colValor]],
    body: pasivos.map((p) => [
      p.nombre,
      L.pasivoCat(p.categoria),
      L.money(p.monto),
    ]),
    foot: [
      [L.total, "", L.money(balance.pasivos)],
      [L.patrimonio, "", L.money(balance.patrimonio)],
    ],
    theme: "striped",
    headStyles: { fillColor: ACCENT },
    footStyles: { fillColor: [30, 30, 40], textColor: 255 },
    columnStyles: { 2: { halign: "right" } },
  });

  return doc.output("blob");
}

/** Nombre de hoja válido para Excel (máx 31, sin caracteres prohibidos). */
function safeSheet(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Hoja";
}

/** Informe contable → Excel (Blob .xlsx). Una hoja por sección. */
export async function buildContabilidadXLSX(
  d: ContabilidadData,
  L: ContabilidadLabels,
): Promise<Blob> {
  const { balance, pl, gastos, bienes, pasivos } = computar(d);
  const wb = new ExcelJS.Workbook();

  const resumen = wb.addWorksheet(safeSheet(L.resultados));
  resumen.addRow([L.title]);
  resumen.addRow([L.generado]);
  resumen.addRow([]);
  resumen.addRow([L.ingresos, pl.ingresos]);
  resumen.addRow([L.gastos, pl.gastos]);
  resumen.addRow([L.utilidad, pl.utilidad]);
  resumen.addRow([L.margen, pl.margen]);
  resumen.addRow([]);
  resumen.addRow([L.patrimonio, balance.patrimonio]);

  const gs = wb.addWorksheet(safeSheet(L.seccionGastos));
  gs.addRow([L.colFecha, L.colConcepto, L.colCategoria, L.colMonto]);
  for (const g of gastos)
    gs.addRow([L.date(g.fecha), g.concepto, L.gastoCat(g.categoria), g.monto]);
  gs.addRow([L.total, "", "", pl.gastos]);

  const bn = wb.addWorksheet(safeSheet(L.seccionBienes));
  bn.addRow([L.colConcepto, L.colCategoria, L.colValor]);
  for (const a of bienes)
    bn.addRow([a.nombre, L.activoCat(a.categoria), valorEnLibros(a, d.ahora)]);
  bn.addRow([L.total, "", balance.activos]);

  const pv = wb.addWorksheet(safeSheet(L.seccionPasivos));
  pv.addRow([L.colConcepto, L.colCategoria, L.colValor]);
  for (const p of pasivos)
    pv.addRow([p.nombre, L.pasivoCat(p.categoria), p.monto]);
  pv.addRow([L.total, "", balance.pasivos]);
  pv.addRow([L.patrimonio, "", balance.patrimonio]);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
