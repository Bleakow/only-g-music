/**
 * Entidad de dominio: disponibilidad del productor (1 por sede). Modela la
 * agenda mensual como una PLANTILLA SEMANAL + EXCEPCIONES por fecha, y deriva
 * los slots y el estado visual de cada día. Tipos + lógica PURA (cliente y
 * servidor). No importar UI ni Firebase aquí.
 */

import type { SedeId } from "./sede";

/** Ventana horaria de un día de trabajo (formato "HH:mm"). */
export interface VentanaHoraria {
  desde: string;
  hasta: string;
}

/**
 * Plantilla semanal: por día de semana (0=Dom … 6=Sáb), la ventana de trabajo
 * o `null` si ese día no trabaja.
 */
export type PlantillaSemanal = Record<number, VentanaHoraria | null>;

/**
 * Disponibilidad de un mes para una sede. Base = plantilla semanal; las
 * `excepciones` por fecha la sobreescriben (día libre o ventana distinta).
 */
export interface DisponibilidadMes {
  /** `${sedeId}_${mes}`. */
  id: string;
  sedeId: SedeId;
  productorId: string;
  /** "YYYY-MM". */
  mes: string;
  plantilla: PlantillaSemanal;
  /** Por fecha "YYYY-MM-DD": ventana distinta, o `null` = ese día NO trabaja. */
  excepciones: Record<string, VentanaHoraria | null>;
  updatedAt: number;
}

/** Datos para crear/guardar (sin id/updatedAt; los pone el repo). */
export type NewDisponibilidadMes = Omit<DisponibilidadMes, "id" | "updatedAt">;

/** Intervalo entre slots, en minutos. */
export const SLOT_MIN = 60;

/** Estado visual de un día en el calendario. */
export type EstadoDia = "cerrado" | "libre" | "parcial" | "lleno";

/**
 * Plantilla por defecto: Lun–Sáb 10:00–16:00 (6 h), domingo libre. Es la que el
 * productor puede aplicar con un clic ("programación por defecto").
 */
export function plantillaPorDefecto(): PlantillaSemanal {
  const v: VentanaHoraria = { desde: "10:00", hasta: "16:00" };
  return { 0: null, 1: v, 2: v, 3: v, 4: v, 5: v, 6: null };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Horas de inicio de slot dentro de una ventana, cada `stepMin` minutos. */
export function slotsDeVentana(v: VentanaHoraria, stepMin = SLOT_MIN): string[] {
  const start = toMinutes(v.desde);
  const end = toMinutes(v.hasta);
  const out: string[] = [];
  for (let t = start; t + stepMin <= end; t += stepMin) out.push(toHHMM(t));
  return out;
}

/** Ventana efectiva de una fecha (la excepción manda sobre la plantilla). */
export function ventanaDeFecha(
  disp: DisponibilidadMes,
  fecha: string,
  weekday: number,
): VentanaHoraria | null {
  if (Object.prototype.hasOwnProperty.call(disp.excepciones, fecha)) {
    return disp.excepciones[fecha];
  }
  return disp.plantilla[weekday] ?? null;
}

/** Slots de 1 h que cubre una reserva que empieza en `start` y dura `durationMin`. */
export function slotsCubiertos(
  start: string,
  durationMin: number,
  stepMin = SLOT_MIN,
): string[] {
  const s = toMinutes(start);
  const n = Math.max(1, Math.ceil(durationMin / stepMin));
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(toHHMM(s + i * stepMin));
  return out;
}

/** Slots ofertados en una fecha (vacío = el productor no trabaja ese día). */
export function slotsDeFecha(
  disp: DisponibilidadMes,
  fecha: string,
  weekday: number,
): string[] {
  const v = ventanaDeFecha(disp, fecha, weekday);
  return v ? slotsDeVentana(v) : [];
}

/**
 * Estado de un día según los slots ofertados y los ya reservados.
 * - sin slots ofertados → `cerrado`
 * - ninguno reservado   → `libre`
 * - todos reservados    → `lleno`
 * - algunos reservados  → `parcial`
 */
export function estadoDia(
  slotsOfertados: string[],
  slotsReservados: string[],
): EstadoDia {
  if (slotsOfertados.length === 0) return "cerrado";
  const tomados = slotsReservados.filter((s) =>
    slotsOfertados.includes(s),
  ).length;
  if (tomados === 0) return "libre";
  if (tomados >= slotsOfertados.length) return "lleno";
  return "parcial";
}
