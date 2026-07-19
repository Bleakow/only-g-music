/**
 * Export del Balance General (PURO): genera CSV y PDF premium a partir de los
 * datos ya cargados. Sin DOM ni Firebase aquí — el componente se encarga de la
 * descarga (Blob). Las etiquetas llegan ya traducidas (i18n) para no acoplar el
 * dominio a next-intl.
 *
 * CSV → números CRUDOS (parseables por una hoja de cálculo).
 * PDF → documento diseñado (react-pdf), unificado con el Informe Contable.
 */
import { createElement, type ReactElement } from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import {
  type Activo,
  type Pasivo,
  type ActivoCategoria,
  type PasivoCategoria,
  type BalanceGeneral,
  activoVigente,
  pasivoVigente,
  valorEnLibros,
} from "@only-g/shared-types/contabilidad";
import { BalanceReport } from "./pdf/BalanceReport";
import type { BalanceLabels, BalanceModel } from "./pdf/types";

export interface BalanceExportLabels {
  title: string;
  generado: string; // "Generado: <fecha>" (CSV)
  seccionActivos: string;
  seccionPasivos: string;
  totalActivos: string;
  totalPasivos: string;
  patrimonio: string;
  ecuacion: string; // "Activos = Pasivos + Patrimonio"
  colConcepto: string;
  colCategoria: string;
  colValor: string;
  activoCat: (c: ActivoCategoria) => string;
  pasivoCat: (c: PasivoCategoria) => string;
  /** Etiqueta de categoría para las filas de payout ("Payout a socio"). */
  payoutCat: string;
  money: (n: number) => string;
  // --- extras para el PDF premium (el CSV los ignora) ---
  docTitle: string;
  brand: string;
  generadoLabel: string;
  generadoValue: string;
  resumen: string;
  assets: string;
  liabilities: string;
  patrimonioNeto: string;
  sinActivos: string;
  sinPasivos: string;
  footerCopy: string;
  footerNote: string;
}

/**
 * Fila de payout pendiente para el export. Es una cuenta por pagar DERIVADA (no
 * vive en la colección `pasivos`): se lista dentro de la sección de pasivos para
 * que las líneas cuadren con el total (`balance.pasivos`, que ya la incluye).
 */
export interface PayoutExportRow {
  concepto: string;
  monto: number;
}

function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}
function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

/** Balance → CSV (números crudos, separador coma, CRLF). */
export function balanceToCSV(
  activos: Activo[],
  pasivos: Pasivo[],
  balance: BalanceGeneral,
  ahora: number,
  L: BalanceExportLabels,
  payouts: PayoutExportRow[] = [],
): string {
  const lines: string[] = [];
  lines.push(csvRow([L.title]));
  lines.push(csvRow([L.generado]));
  lines.push("");

  lines.push(csvRow([L.seccionActivos]));
  lines.push(csvRow([L.colConcepto, L.colCategoria, L.colValor]));
  for (const a of activos.filter((x) => activoVigente(x, ahora))) {
    lines.push(
      csvRow([a.nombre, L.activoCat(a.categoria), Math.round(valorEnLibros(a, ahora))]),
    );
  }
  lines.push(csvRow([L.totalActivos, "", Math.round(balance.activos)]));
  lines.push("");

  lines.push(csvRow([L.seccionPasivos]));
  lines.push(csvRow([L.colConcepto, L.colCategoria, L.colValor]));
  for (const p of pasivos.filter((x) => pasivoVigente(x, ahora))) {
    lines.push(csvRow([p.nombre, L.pasivoCat(p.categoria), Math.round(p.monto)]));
  }
  for (const p of payouts) {
    lines.push(csvRow([p.concepto, L.payoutCat, Math.round(p.monto)]));
  }
  lines.push(csvRow([L.totalPasivos, "", Math.round(balance.pasivos)]));
  lines.push("");

  lines.push(csvRow([L.patrimonio, "", Math.round(balance.patrimonio)]));
  return lines.join("\r\n");
}

/** Balance → PDF premium (Blob). Portada (Activos·Pasivos·Patrimonio + ecuación)
 *  y páginas de Activos y Pasivos que paginan solas. Los payouts pendientes se
 *  mezclan en las filas de pasivos (ya sumados a `balance.pasivos`). */
export function buildBalancePDF(
  activos: Activo[],
  pasivos: Pasivo[],
  balance: BalanceGeneral,
  ahora: number,
  L: BalanceExportLabels,
  payouts: PayoutExportRow[] = [],
): Promise<Blob> {
  const activosRows = activos
    .filter((a) => activoVigente(a, ahora))
    .map((a) => [
      a.nombre,
      L.activoCat(a.categoria),
      L.money(valorEnLibros(a, ahora)),
    ]);

  const pasivosRows = [
    ...pasivos
      .filter((p) => pasivoVigente(p, ahora))
      .map((p) => [p.nombre, L.pasivoCat(p.categoria), L.money(p.monto)]),
    ...payouts.map((p) => [p.concepto, L.payoutCat, L.money(p.monto)]),
  ];

  const model: BalanceModel = {
    assets: L.money(balance.activos),
    liabilities: L.money(balance.pasivos),
    patrimonio: L.money(balance.patrimonio),
    patrimonioNegative: balance.patrimonio < 0,
    activosRows,
    pasivosRows,
    totalActivos: L.money(balance.activos),
    totalPasivos: L.money(balance.pasivos),
  };

  const labels: BalanceLabels = {
    docTitle: L.docTitle,
    brand: L.brand,
    generadoLabel: L.generadoLabel,
    generadoValue: L.generadoValue,
    resumen: L.resumen,
    seccionActivos: L.seccionActivos,
    seccionPasivos: L.seccionPasivos,
    patrimonioNeto: L.patrimonioNeto,
    colConcepto: L.colConcepto,
    colCategoria: L.colCategoria,
    colValor: L.colValor,
    assets: L.assets,
    liabilities: L.liabilities,
    totalActivos: L.totalActivos,
    totalPasivos: L.totalPasivos,
    ecuacion: L.ecuacion,
    sinActivos: L.sinActivos,
    sinPasivos: L.sinPasivos,
    footerCopy: L.footerCopy,
    footerNote: L.footerNote,
  };

  return pdf(
    createElement(BalanceReport, { model, L: labels }) as ReactElement<DocumentProps>,
  ).toBlob();
}
