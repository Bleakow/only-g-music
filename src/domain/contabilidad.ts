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
