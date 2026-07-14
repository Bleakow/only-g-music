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

/** Respuesta del usuario a "¿pagaste este egreso recurrente?" (una por periodo). */
export type ConfirmacionEstado = "pagado" | "no_pagado";

export interface Confirmacion {
  estado: ConfirmacionEstado;
  /** Monto realmente pagado, si difirió del de la plantilla. */
  montoReal?: number;
  confirmadoEn: number;
}

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
  /** Fin de la recurrencia (epoch ms). Sin él, recurre hasta que se anule. */
  recurrenciaHasta?: number;
  sede?: SedeId;
  comprobanteUrl?: string;
  nota?: string;
  /** Confirmaciones de ocurrencias recurrentes, por clave de periodo ("YYYY-MM"
   *  mensual, "YYYY" anual). Solo aplica a gastos recurrentes. */
  confirmaciones?: Record<string, Confirmacion>;
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

// ── Ocurrencias de gasto (expansión de recurrentes) ─────────────────────────

/** Suma `meses` a una fecha recortando el día al último del mes destino (evita
 *  el desborde de JS: 31 ene + 1 mes ≠ 3 mar). */
function sumarMeses(base: Date, meses: number): number {
  const total = base.getMonth() + meses;
  const anio = base.getFullYear() + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimoDia = new Date(anio, mes + 1, 0).getDate();
  return new Date(anio, mes, Math.min(base.getDate(), ultimoDia)).getTime();
}

/** Clave de periodo de una ocurrencia ("YYYY-MM" mensual, "YYYY" anual). */
export function claveOcurrencia(fecha: number, recurrencia: Recurrencia): string {
  const d = new Date(fecha);
  if (recurrencia === "anual") return `${d.getFullYear()}`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Estado de un egreso concreto. */
export type OcurrenciaEstado = "unico" | "pagado" | "pendiente" | "no_pagado";

/** Un egreso concreto (ocurrencia de un gasto único o recurrente). */
export interface GastoOcurrencia {
  movimientoId: string;
  concepto: string;
  categoria: GastoCategoria;
  /** Monto efectivo del egreso (montoReal si se confirmó distinto). */
  monto: number;
  fecha: number;
  sede?: SedeId;
  recurrente: boolean;
  estado: OcurrenciaEstado;
  /** Clave de periodo para confirmar (solo recurrentes). */
  clave?: string;
}

/**
 * Expande UN gasto a sus egresos dentro del periodo. Único → su fecha (si no está
 * anulado). Recurrente → una ocurrencia por periodo desde `fecha` hasta `ahora`
 * (no se cuentan egresos futuros), respetando anulación y fin de recurrencia. El
 * estado de cada recurrente sale de su confirmación (pendiente si aún no hay).
 */
export function ocurrenciasMovimiento(
  m: Movimiento,
  periodo: Periodo,
  ahora: number,
): GastoOcurrencia[] {
  if (m.recurrencia === "unico") {
    if (m.anuladoAt != null) return [];
    if (m.fecha > ahora || !enPeriodo(m.fecha, periodo)) return [];
    return [
      {
        movimientoId: m.id,
        concepto: m.concepto,
        categoria: m.categoria,
        monto: m.monto,
        fecha: m.fecha,
        sede: m.sede,
        recurrente: false,
        estado: "unico",
      },
    ];
  }

  const out: GastoOcurrencia[] = [];
  const base = new Date(m.fecha);
  const paso = m.recurrencia === "mensual" ? 1 : 12;
  for (let i = 0; i <= 1200; i++) {
    const ms = sumarMeses(base, i * paso);
    if (ms > ahora) break; // aún no ocurre
    if (m.anuladoAt != null && ms >= m.anuladoAt) break; // serie cortada
    if (m.recurrenciaHasta != null && ms > m.recurrenciaHasta) break; // fin
    if (!enPeriodo(ms, periodo)) continue;
    const clave = claveOcurrencia(ms, m.recurrencia);
    const conf = m.confirmaciones?.[clave];
    const estado: OcurrenciaEstado =
      conf?.estado === "pagado"
        ? "pagado"
        : conf?.estado === "no_pagado"
          ? "no_pagado"
          : "pendiente";
    out.push({
      movimientoId: m.id,
      concepto: m.concepto,
      categoria: m.categoria,
      monto: conf?.estado === "pagado" ? (conf.montoReal ?? m.monto) : m.monto,
      fecha: ms,
      sede: m.sede,
      recurrente: true,
      estado,
      clave,
    });
  }
  return out;
}

/** Expande TODOS los gastos a egresos del periodo (recientes primero). */
export function expandirGastos(
  movimientos: Movimiento[],
  periodo: Periodo,
  ahora: number,
): GastoOcurrencia[] {
  const out: GastoOcurrencia[] = [];
  for (const m of movimientos)
    out.push(...ocurrenciasMovimiento(m, periodo, ahora));
  return out.sort((a, b) => b.fecha - a.fecha);
}

/** ¿La ocurrencia cuenta en el P&L? (único, o recurrente confirmado pagado). */
export function cuentaEnPnl(o: GastoOcurrencia): boolean {
  return o.estado === "unico" || o.estado === "pagado";
}

/**
 * Cola "por confirmar": ocurrencias recurrentes vencidas SIN respuesta, de todas
 * las series, más antiguas primero. Los únicos son hechos → no entran aquí.
 */
export function pendientesDeConfirmar(
  movimientos: Movimiento[],
  ahora: number,
): GastoOcurrencia[] {
  return expandirGastos(movimientos, PERIODO_TODO, ahora)
    .filter((o) => o.estado === "pendiente")
    .sort((a, b) => a.fecha - b.fecha);
}

/** ¿Es un gasto recurrente (mensual/anual)? */
export function esRecurrente(m: Movimiento): boolean {
  return m.recurrencia !== "unico";
}

/** ¿Recurrente todavía activo (no anulado, no vencido) a la fecha? */
export function esRecurrenteActivo(m: Movimiento, ahora: number): boolean {
  return (
    esRecurrente(m) &&
    (m.anuladoAt == null || m.anuladoAt > ahora) &&
    (m.recurrenciaHasta == null || m.recurrenciaHasta >= ahora)
  );
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
  for (const o of expandirGastos(movimientos, periodo, ahora)) {
    if (!cuentaEnPnl(o)) continue;
    gastos += o.monto;
    const cur =
      map.get(o.categoria) ??
      ({ categoria: o.categoria, monto: 0, cantidad: 0 } as GastoPorCategoria);
    cur.monto += o.monto;
    cur.cantidad += 1;
    map.set(o.categoria, cur);
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
 *
 * `pasivosExtra`: pasivos DERIVADOS que no viven en la colección `pasivos`
 * (p. ej. Σ de los payouts pendientes a socios). Se suman al total de pasivos
 * vigentes. Se mantiene puro: la capa de features inyecta la cifra ya calculada.
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
  pasivosExtra: number = 0,
): BalanceGeneral {
  const totA = totalesInventario(activos, ahora).valorEnLibrosTotal;
  const totP = totalPasivos(pasivos, ahora) + pasivosExtra;
  return { activos: totA, pasivos: totP, patrimonio: totA - totP };
}
