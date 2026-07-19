/**
 * Informe contable COMPLETO → PDF premium (react-pdf) y Excel (ExcelJS). Toma los
 * datos crudos ya cargados y calcula con el dominio (P&L, balance, etc.). Pesa
 * bastante (react-pdf/ExcelJS), así que se importa EN DIFERIDO desde el componente.
 * Las etiquetas llegan traducidas (i18n) para no acoplar el dominio a next-intl.
 *
 * El PDF es un DOCUMENTO diseñado: portada con resumen + gráfico, y una página
 * por sección de detalle que pagina sola. El layout vive en ./pdf/*; aquí solo
 * calculamos y formateamos el modelo de presentación.
 */
import { createElement, type ReactElement } from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import {
  type Activo,
  type Pasivo,
  type Movimiento,
  type Periodo,
  balanceGeneral,
  estadoResultados,
  expandirGastos,
  cuentaEnPnl,
  activoVigente,
  pasivoVigente,
  valorEnLibros,
} from "@only-g/shared-types/contabilidad";
import type { Transaccion } from "@only-g/shared-types/transaccion";
import { ContabilidadReport } from "./pdf/ContabilidadReport";
import type { ContabilidadLabels, ContabilidadModel } from "./pdf/types";

export type { ContabilidadLabels } from "./pdf/types";

export interface ContabilidadData {
  activos: Activo[];
  pasivos: Pasivo[];
  movimientos: Movimiento[];
  transacciones: Transaccion[];
  ahora: number;
}

/** Fecha de corte del BALANCE para el periodo: fin del periodo (exclusivo) pero
 *  nunca en el futuro. Un informe de "Junio 2026" muestra el balance al cierre de
 *  junio; "Todo el histórico" → ahora. Así valorEnLibros/vigencia son coherentes
 *  con el mes elegido en vez de mezclar el estado de hoy con un P&L pasado. */
function corteDe(periodo: Periodo, ahora: number): number {
  return periodo.hasta != null ? Math.min(periodo.hasta, ahora) : ahora;
}

function computar(d: ContabilidadData, periodo: Periodo, corte: number) {
  return {
    balance: balanceGeneral(d.activos, d.pasivos, corte),
    pl: estadoResultados(d.transacciones, d.movimientos, periodo, d.ahora),
    gastos: expandirGastos(d.movimientos, periodo, d.ahora).filter(cuentaEnPnl),
    bienes: d.activos.filter((a) => activoVigente(a, corte)),
    pasivos: d.pasivos.filter((p) => pasivoVigente(p, corte)),
  };
}

/** Aplana el dominio a un modelo de presentación ya formateado (strings + los
 *  pocos números que el gráfico necesita para escalar). */
function buildModel(
  d: ContabilidadData,
  L: ContabilidadLabels,
  periodo: Periodo,
): ContabilidadModel {
  const corte = corteDe(periodo, d.ahora);
  const { balance, pl, gastos, bienes, pasivos } = computar(d, periodo, corte);
  const maxChart = Math.max(pl.ingresos, pl.gastos, 1);

  return {
    ingresos: L.money(pl.ingresos),
    gastos: L.money(pl.gastos),
    utilidad: { value: L.money(pl.utilidad), negative: pl.utilidad < 0 },
    margen: {
      value: `${Math.round(pl.margen * 100)}%`,
      negative: pl.margen < 0,
    },
    chart: {
      ingresos: pl.ingresos,
      gastos: pl.gastos,
      ingresosDisplay: L.money(pl.ingresos),
      gastosDisplay: L.money(pl.gastos),
      maxDisplay: L.money(maxChart),
    },
    gastosRows: gastos.map((g) => [
      L.date(g.fecha),
      g.concepto,
      L.gastoCat(g.categoria),
      L.money(g.monto),
    ]),
    gastosTotal: L.money(pl.gastos),
    bienesRows: bienes.map((a) => [
      a.nombre,
      L.activoCat(a.categoria),
      L.money(valorEnLibros(a, corte)),
    ]),
    bienesTotal: L.money(balance.activos),
    pasivosRows: pasivos.map((p) => [
      p.nombre,
      L.pasivoCat(p.categoria),
      L.money(p.monto),
    ]),
    pasivosTotal: L.money(balance.pasivos),
    patrimonio: L.money(balance.patrimonio),
  };
}

/** Informe contable → PDF (Blob). Portada + páginas de Gastos, Bienes, Pasivos.
 *  `periodo` acota el P&L/gastos y la fecha de corte del balance (informe mensual). */
export function buildContabilidadPDF(
  d: ContabilidadData,
  L: ContabilidadLabels,
  periodo: Periodo,
): Promise<Blob> {
  const model = buildModel(d, L, periodo);
  return pdf(
    createElement(ContabilidadReport, { model, L }) as ReactElement<DocumentProps>,
  ).toBlob();
}

/** Nombre de hoja válido para Excel (máx 31, sin caracteres prohibidos). */
function safeSheet(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Hoja";
}

/** Informe contable → Excel (Blob .xlsx). Una hoja por sección. */
export async function buildContabilidadXLSX(
  d: ContabilidadData,
  L: ContabilidadLabels,
  periodo: Periodo,
): Promise<Blob> {
  const corte = corteDe(periodo, d.ahora);
  const { balance, pl, gastos, bienes, pasivos } = computar(d, periodo, corte);
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
    bn.addRow([a.nombre, L.activoCat(a.categoria), valorEnLibros(a, corte)]);
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
