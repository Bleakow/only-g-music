/**
 * Export del Balance General (PURO): genera CSV y HTML imprimible a partir de los
 * datos ya cargados. Sin DOM ni Firebase aquí — el componente se encarga de la
 * descarga (Blob) y de abrir la ventana de impresión. Las etiquetas llegan ya
 * traducidas (i18n) para no acoplar el dominio a next-intl.
 *
 * CSV → números CRUDOS (parseables por una hoja de cálculo).
 * HTML → montos formateados (COP) para imprimir / guardar como PDF.
 */
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

export interface BalanceExportLabels {
  title: string;
  generado: string; // "Generado: <fecha>"
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

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Balance → documento HTML imprimible (blanco/negro, auto-print al cargar). */
export function balanceToHTML(
  activos: Activo[],
  pasivos: Pasivo[],
  balance: BalanceGeneral,
  ahora: number,
  L: BalanceExportLabels,
  payouts: PayoutExportRow[] = [],
): string {
  const row = (nombre: string, cat: string, valor: number) =>
    `<tr><td>${esc(nombre)}</td><td>${esc(cat)}</td><td class="n">${esc(
      L.money(valor),
    )}</td></tr>`;

  const activosRows = activos
    .filter((a) => activoVigente(a, ahora))
    .map((a) => row(a.nombre, L.activoCat(a.categoria), valorEnLibros(a, ahora)))
    .join("");
  const pasivosRows =
    pasivos
      .filter((p) => pasivoVigente(p, ahora))
      .map((p) => row(p.nombre, L.pasivoCat(p.categoria), p.monto))
      .join("") +
    payouts.map((p) => row(p.concepto, L.payoutCat, p.monto)).join("");

  const totalRow = (label: string, valor: number) =>
    `<tr class="tot"><td colspan="2">${esc(label)}</td><td class="n">${esc(
      L.money(valor),
    )}</td></tr>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(L.title)}</title>
<style>
  *{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111}
  body{margin:40px;max-width:720px}
  h1{font-size:24px;margin:0 0 4px}
  .sub{color:#666;font-size:12px;margin:0 0 24px}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:1px;margin:24px 0 8px;border-bottom:2px solid #111;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td{padding:6px 8px;border-bottom:1px solid #eee}
  th{text-align:left;padding:6px 8px;font-size:11px;text-transform:uppercase;color:#666}
  .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .tot td{font-weight:700;border-top:1px solid #111;border-bottom:none}
  .eq{margin-top:32px;padding:12px;background:#f3f3f3;border-radius:8px;font-weight:700;text-align:center}
  @media print{body{margin:16px}}
</style></head>
<body>
  <h1>${esc(L.title)}</h1>
  <p class="sub">${esc(L.generado)}</p>

  <h2>${esc(L.seccionActivos)}</h2>
  <table><thead><tr><th>${esc(L.colConcepto)}</th><th>${esc(
    L.colCategoria,
  )}</th><th class="n">${esc(L.colValor)}</th></tr></thead>
  <tbody>${activosRows}${totalRow(L.totalActivos, balance.activos)}</tbody></table>

  <h2>${esc(L.seccionPasivos)}</h2>
  <table><thead><tr><th>${esc(L.colConcepto)}</th><th>${esc(
    L.colCategoria,
  )}</th><th class="n">${esc(L.colValor)}</th></tr></thead>
  <tbody>${pasivosRows}${totalRow(L.totalPasivos, balance.pasivos)}</tbody></table>

  <table style="margin-top:16px"><tbody>${totalRow(
    L.patrimonio,
    balance.patrimonio,
  )}</tbody></table>

  <p class="eq">${esc(L.ecuacion)}</p>
  <script>window.onload=function(){window.print()}</script>
</body></html>`;
}
