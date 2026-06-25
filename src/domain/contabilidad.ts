/**
 * Contabilidad de GESTIÓN (PURA): bienes / activos fijos (PP&E) de la productora.
 * Entidad `Activo` + depreciación lineal + valor en libros + totales. Sin UI ni
 * Firebase aquí — solo tipos y cálculos deterministas (la fecha "ahora" la inyecta
 * el llamador para que todo sea testeable y portable).
 *
 * Disciplina (ver Roadmap §16): esto es contabilidad de gestión PRESENTABLE para
 * el dueño/inversores, NO libros legales (DIAN/NIIF/partida doble). La app
 * reconcilia, no reemplaza al contador. Montos en COP (formatea con `formatCOP`).
 */
import type { SedeId } from "@/domain/sede";
import type { Transaccion } from "@/domain/transaccion";

/** Categorías de activo fijo relevantes para una productora musical. */
export type ActivoCategoria =
  | "equipo_produccion" // consolas, monitores, interfaces
  | "equipo_grabacion" // micrófonos, previos, acústica
  | "computo" // computadores, discos, periféricos
  | "instrumentos"
  | "mobiliario"
  | "inmueble"
  | "otro";

export const ACTIVO_CATEGORIAS: ActivoCategoria[] = [
  "equipo_produccion",
  "equipo_grabacion",
  "computo",
  "instrumentos",
  "mobiliario",
  "inmueble",
  "otro",
];

/**
 * Un bien/activo fijo. Append-only: NO se borra, se da de baja (`bajaAt`). La
 * depreciación es derivada (no se persiste): se calcula a la fecha de consulta.
 */
export interface Activo {
  id: string;
  nombre: string;
  categoria: ActivoCategoria;
  /** Valor de adquisición en COP. */
  valorAdquisicion: number;
  /** Fecha de adquisición (epoch ms). */
  fechaAdquisicion: number;
  /** Foto del bien (Storage). */
  fotoUrl?: string;
  /** Sede donde está el bien. */
  sede?: SedeId;
  /** Vida útil en meses. Sin ella → el bien no se deprecia en el modelo. */
  vidaUtilMeses?: number;
  /** Valor residual al final de la vida útil (COP). Default 0. */
  valorResidual?: number;
  /** IVA diferido (informativo; lo define el contador). */
  ivaDiferido?: number;
  /** Notas libres (serie, factura, etc.). */
  nota?: string;
  // ── Auditoría (append-only) ──
  createdBy: string;
  createdAt: number;
  /** Baja lógica: fecha en que dejó de ser un activo (venta/descarte). */
  bajaAt?: number;
  bajaMotivo?: string;
}

/** Datos para dar de alta un bien (sin id ni auditoría: los pone el repo). */
export type NuevoActivo = Omit<
  Activo,
  "id" | "createdBy" | "createdAt" | "bajaAt" | "bajaMotivo"
>;

/**
 * Meses COMPLETOS transcurridos entre dos epoch ms (≥ 0). Cuenta un mes solo
 * cuando se alcanza el mismo día del mes (depreciación por mes cumplido, no
 * prorrateo diario — basta para una vista de gestión).
 */
export function mesesTranscurridos(desde: number, hasta: number): number {
  if (hasta <= desde) return 0;
  const a = new Date(desde);
  const b = new Date(hasta);
  const brutos =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  const completos = b.getDate() >= a.getDate() ? brutos : brutos - 1;
  return Math.max(0, completos);
}

/**
 * Depreciación lineal ACUMULADA a la fecha `ahora`. Sin vida útil → 0 (el bien no
 * se deprecia). Nunca deprecia por debajo del valor residual ni más allá de la
 * vida útil (a partir de ahí el bien queda en su valor residual).
 */
export function depreciacionAcumulada(activo: Activo, ahora: number): number {
  const vida = activo.vidaUtilMeses ?? 0;
  if (vida <= 0) return 0;
  const residual = activo.valorResidual ?? 0;
  const depreciable = Math.max(0, activo.valorAdquisicion - residual);
  const meses = Math.min(vida, mesesTranscurridos(activo.fechaAdquisicion, ahora));
  return (depreciable * meses) / vida;
}

/**
 * Valor en libros = adquisición − depreciación acumulada (acotado al valor
 * residual). Un bien dado de baja vale 0 a partir de su baja.
 */
export function valorEnLibros(activo: Activo, ahora: number): number {
  if (activo.bajaAt != null && activo.bajaAt <= ahora) return 0;
  return activo.valorAdquisicion - depreciacionAcumulada(activo, ahora);
}

/** ¿El bien sigue vigente (no dado de baja) a la fecha `ahora`? */
export function activoVigente(activo: Activo, ahora: number): boolean {
  return activo.bajaAt == null || activo.bajaAt > ahora;
}

export interface TotalesInventario {
  /** Suma de valores de adquisición de los bienes vigentes. */
  valorAdquisicionTotal: number;
  /** Suma de valores en libros de los bienes vigentes. */
  valorEnLibrosTotal: number;
  /** Depreciación acumulada total (adquisición − libros). */
  depreciacionTotal: number;
  /** Cantidad de bienes vigentes. */
  cantidad: number;
}

/** Totales del inventario a la fecha `ahora` (solo bienes vigentes). */
export function totalesInventario(
  activos: Activo[],
  ahora: number,
): TotalesInventario {
  let valorAdquisicionTotal = 0;
  let valorEnLibrosTotal = 0;
  let cantidad = 0;
  for (const a of activos) {
    if (!activoVigente(a, ahora)) continue;
    valorAdquisicionTotal += a.valorAdquisicion;
    valorEnLibrosTotal += valorEnLibros(a, ahora);
    cantidad += 1;
  }
  return {
    valorAdquisicionTotal,
    valorEnLibrosTotal,
    depreciacionTotal: valorAdquisicionTotal - valorEnLibrosTotal,
    cantidad,
  };
}

export interface ValorPorCategoria {
  categoria: ActivoCategoria;
  valorEnLibros: number;
  cantidad: number;
}

/** Valor en libros agrupado por categoría (desglose del inventario), de mayor a menor. */
export function valorPorCategoria(
  activos: Activo[],
  ahora: number,
): ValorPorCategoria[] {
  const map = new Map<ActivoCategoria, ValorPorCategoria>();
  for (const a of activos) {
    if (!activoVigente(a, ahora)) continue;
    const cur =
      map.get(a.categoria) ??
      ({ categoria: a.categoria, valorEnLibros: 0, cantidad: 0 } as ValorPorCategoria);
    cur.valorEnLibros += valorEnLibros(a, ahora);
    cur.cantidad += 1;
    map.set(a.categoria, cur);
  }
  return [...map.values()].sort((x, y) => y.valorEnLibros - x.valorEnLibros);
}

// ── Gastos (movimientos manuales) ──────────────────────────────────────────

/** Categorías de gasto operativo de la productora. */
export type GastoCategoria =
  | "nomina"
  | "arriendo"
  | "servicios" // luz, agua, internet
  | "equipos" // compras menores no capitalizables
  | "marketing"
  | "software" // licencias, SaaS
  | "impuestos"
  | "otro";

export const GASTO_CATEGORIAS: GastoCategoria[] = [
  "nomina",
  "arriendo",
  "servicios",
  "equipos",
  "marketing",
  "software",
  "impuestos",
  "otro",
];

/** Periodicidad del gasto (informativa; no genera asientos futuros automáticos). */
export type Recurrencia = "unico" | "mensual" | "anual";

export const RECURRENCIAS: Recurrencia[] = ["unico", "mensual", "anual"];

/**
 * Un gasto manual. Append-only: NO se borra, se anula (`anuladoAt`) — así el
 * libro conserva la auditoría. Monto SIEMPRE positivo (es una salida).
 */
export interface Movimiento {
  id: string;
  categoria: GastoCategoria;
  concepto: string;
  /** Monto en COP (positivo). */
  monto: number;
  /** Fecha del gasto (epoch ms). */
  fecha: number;
  recurrencia: Recurrencia;
  sede?: SedeId;
  comprobanteUrl?: string;
  nota?: string;
  // ── Auditoría (append-only) ──
  createdBy: string;
  createdAt: number;
  /** Anulación lógica (reversa): a partir de aquí no cuenta en el P&L. */
  anuladoAt?: number;
  anuladoMotivo?: string;
}

/** Datos para registrar un gasto (sin id ni auditoría: los pone el repo). */
export type NuevoMovimiento = Omit<
  Movimiento,
  "id" | "createdBy" | "createdAt" | "anuladoAt" | "anuladoMotivo"
>;

/** ¿El gasto sigue vigente (no anulado) a la fecha `ahora`? */
export function movimientoVigente(m: Movimiento, ahora: number): boolean {
  return m.anuladoAt == null || m.anuladoAt > ahora;
}

// ── Periodo y Estado de Resultados (P&L) ────────────────────────────────────

/** Rango temporal semiabierto [desde, hasta). `null` = sin límite por ese lado. */
export interface Periodo {
  desde: number | null;
  hasta: number | null;
}

/** Periodo que abarca todo (sin límites). */
export const PERIODO_TODO: Periodo = { desde: null, hasta: null };

/** ¿`fecha` (epoch ms) cae dentro del periodo [desde, hasta)? */
export function enPeriodo(fecha: number, p: Periodo): boolean {
  if (p.desde != null && fecha < p.desde) return false;
  if (p.hasta != null && fecha >= p.hasta) return false;
  return true;
}

/** Periodo de un mes natural (monthIndex 0–11). Puro. */
export function periodoMes(year: number, monthIndex: number): Periodo {
  return {
    desde: new Date(year, monthIndex, 1).getTime(),
    hasta: new Date(year, monthIndex + 1, 1).getTime(),
  };
}

/** Periodo de un año natural. Puro. */
export function periodoAnio(year: number): Periodo {
  return {
    desde: new Date(year, 0, 1).getTime(),
    hasta: new Date(year + 1, 0, 1).getTime(),
  };
}

export interface GastoPorCategoria {
  categoria: GastoCategoria;
  monto: number;
  cantidad: number;
}

/** Estado de Resultados simplificado de un periodo. */
export interface EstadoResultados {
  ingresos: number;
  gastos: number;
  /** ingresos − gastos. */
  utilidad: number;
  /** Margen = utilidad / ingresos (0 si no hay ingresos). */
  margen: number;
  gastosPorCategoria: GastoPorCategoria[];
}

/**
 * P&L del periodo: ingresos (transacciones) − gastos (movimientos VIGENTES),
 * ambos filtrados por fecha. Puro: la UI inyecta los datos, el periodo y `ahora`.
 * Reusa el mismo `Transaccion[]` que `/admin/finanzas` (una sola fuente de ingreso).
 */
export function estadoResultados(
  transacciones: Transaccion[],
  movimientos: Movimiento[],
  periodo: Periodo,
  ahora: number,
): EstadoResultados {
  const ingresos = transacciones
    .filter((t) => enPeriodo(t.fecha, periodo))
    .reduce((s, t) => s + t.amount, 0);

  const map = new Map<GastoCategoria, GastoPorCategoria>();
  let gastos = 0;
  for (const m of movimientos) {
    if (!movimientoVigente(m, ahora)) continue;
    if (!enPeriodo(m.fecha, periodo)) continue;
    gastos += m.monto;
    const cur =
      map.get(m.categoria) ??
      ({ categoria: m.categoria, monto: 0, cantidad: 0 } as GastoPorCategoria);
    cur.monto += m.monto;
    cur.cantidad += 1;
    map.set(m.categoria, cur);
  }

  const utilidad = ingresos - gastos;
  return {
    ingresos,
    gastos,
    utilidad,
    margen: ingresos > 0 ? utilidad / ingresos : 0,
    gastosPorCategoria: [...map.values()].sort((a, b) => b.monto - a.monto),
  };
}

// ── Pasivos y Balance General ───────────────────────────────────────────────

/** Categorías de pasivo (deudas/obligaciones). */
export type PasivoCategoria =
  | "prestamo"
  | "cuenta_por_pagar"
  | "impuesto_por_pagar"
  | "otro";

export const PASIVO_CATEGORIAS: PasivoCategoria[] = [
  "prestamo",
  "cuenta_por_pagar",
  "impuesto_por_pagar",
  "otro",
];

/**
 * Una obligación / deuda. Append-only: NO se borra, se liquida (`saldadoAt`).
 * `monto` es el saldo pendiente en COP (positivo).
 */
export interface Pasivo {
  id: string;
  nombre: string;
  categoria: PasivoCategoria;
  /** Saldo pendiente en COP. */
  monto: number;
  /** Fecha de origen (epoch ms). */
  fecha: number;
  acreedor?: string;
  /** Vencimiento (epoch ms). */
  vencimiento?: number;
  sede?: SedeId;
  nota?: string;
  // ── Auditoría (append-only) ──
  createdBy: string;
  createdAt: number;
  /** Liquidación lógica: a partir de aquí el pasivo está saldado (no cuenta). */
  saldadoAt?: number;
  saldadoMotivo?: string;
}

/** Datos para registrar un pasivo (sin id ni auditoría: los pone el repo). */
export type NuevoPasivo = Omit<
  Pasivo,
  "id" | "createdBy" | "createdAt" | "saldadoAt" | "saldadoMotivo"
>;

/** ¿El pasivo sigue vigente (no saldado) a la fecha `ahora`? */
export function pasivoVigente(p: Pasivo, ahora: number): boolean {
  return p.saldadoAt == null || p.saldadoAt > ahora;
}

/** Suma de saldos de pasivos vigentes. */
export function totalPasivos(pasivos: Pasivo[], ahora: number): number {
  return pasivos
    .filter((p) => pasivoVigente(p, ahora))
    .reduce((s, p) => s + p.monto, 0);
}

/**
 * Balance General simplificado. Ecuación contable: **Activos = Pasivos +
 * Patrimonio**, que cuadra por construcción (Patrimonio = Activos − Pasivos).
 * Activos = valor EN LIBROS de los bienes vigentes (ya depreciados).
 */
export interface BalanceGeneral {
  activos: number;
  pasivos: number;
  /** Patrimonio = Activos − Pasivos. */
  patrimonio: number;
}

export function balanceGeneral(
  activos: Activo[],
  pasivos: Pasivo[],
  ahora: number,
): BalanceGeneral {
  const totA = totalesInventario(activos, ahora).valorEnLibrosTotal;
  const totP = totalPasivos(pasivos, ahora);
  return { activos: totA, pasivos: totP, patrimonio: totA - totP };
}
