/**
 * Entidad de dominio: ciclo de servicio (Reserva / Sesión) y su máquina de
 * estados. Tipos + transiciones PURAS, compartidas por cliente y servidor.
 * No importar UI ni Firebase aquí.
 */

import type { SedeId } from "./sede";

export type ReservaEstado =
  | "pendiente_pago"
  | "pago_en_revision"
  | "confirmada"
  | "en_curso"
  | "completada"
  | "cancelada"
  | "expirada";

/**
 * Tipo de reserva. `sesion` es una cita de estudio (con slot); `entregable` es un
 * servicio sin agenda (mezcla/máster: por cantidad, no ocupa slot); `perfil_artista`
 * es la compra del perfil de artista; `proyecto` nace de una cotización aceptada
 * (sin slot/fecha — se paga y el agendado se coordina en el chat).
 */
export type ReservaTipo = "sesion" | "entregable" | "perfil_artista" | "proyecto";

export interface Reserva {
  id: string;
  /** Cliente dueño de la reserva. */
  uid: string;
  serviceSlug: string;
  serviceName: string;
  variantId?: string;
  sede: SedeId;
  /** Inicio de la cita (epoch ms). */
  start: number;
  /** Duración en minutos. */
  durationMin: number;
  /** Monto en COP. Server-authoritative: servicio fijo o cotización aceptada. */
  amount?: number;
  /** Datos del cliente denormalizados (para tablas/finanzas del admin). */
  clientName?: string;
  clientEmail?: string;
  /** Si la reserva nació de una cotización aceptada. */
  quoteId?: string;
  /** Si la reserva es una línea de un Pedido (compra directa multi-servicio). */
  pedidoId?: string;
  /** Tipo de reserva (por defecto `sesion`). */
  tipo?: ReservaTipo;
  /** Slug del perfil de artista asociado (solo en pedidos `perfil_artista`). */
  artistSlug?: string;
  /** Comprobante de pago subido (URL en Storage), en el flujo de pago manual. */
  comprobanteUrl?: string;
  /** Productor asignado (se llena en operación interna). */
  productorId?: string;
  estado: ReservaEstado;
  createdAt: number;
}

/** Datos que aporta el cliente al crear una reserva (estado/fecha los pone el sistema). */
export type NewReserva = Omit<Reserva, "id" | "estado" | "createdAt">;

export type SesionEstado =
  | "programada"
  | "en_curso"
  | "finalizada"
  | "cancelada";

/**
 * Sesión: ejecución real de una reserva (vista de la consola del productor).
 * Es una PROYECCIÓN SIN datos financieros: el productor ve a quién atiende y
 * cuándo, NUNCA el `amount` (invariante de aislamiento de roles, ver AGENTS.md).
 */
export interface Sesion {
  id: string;
  reservaId: string;
  /** Productor asignado (su consola filtra por este uid). */
  productorId: string;
  /** Cliente: para permisos y para que el productor sepa a quién atiende. */
  uid: string;
  /** Nombre del cliente (operativo, NO financiero). */
  clientName?: string;
  serviceName: string;
  sede: SedeId;
  /** Programados (heredados de la reserva). */
  scheduledStart: number;
  scheduledEnd: number;
  /** Reales: los marca el productor (o el auto-inicio por gracia). */
  startedAt?: number;
  endedAt?: number;
  estado: SesionEstado;
  createdAt: number;
}

/** Datos para crear una sesión (id/estado/fecha y tiempos reales los pone el sistema). */
export type NewSesion = Omit<
  Sesion,
  "id" | "estado" | "createdAt" | "startedAt" | "endedAt"
>;

/** Minutos de gracia: si el productor no la inicia, la sesión arranca sola. */
export const GRACIA_AUTO_INICIO_MIN = 30;

const SESION_TRANSITIONS: Record<SesionEstado, SesionEstado[]> = {
  programada: ["en_curso", "cancelada"],
  en_curso: ["finalizada"],
  finalizada: [],
  cancelada: [],
};

export function nextSesionStates(estado: SesionEstado): SesionEstado[] {
  return SESION_TRANSITIONS[estado];
}

export function canSesionTransition(
  from: SesionEstado,
  to: SesionEstado,
): boolean {
  return SESION_TRANSITIONS[from].includes(to);
}

/**
 * ¿Debe auto-iniciarse por gracia? Programada y ya pasados los 30 min desde la
 * hora agendada (puro). En 14a el disparo es client-side mientras la consola
 * esté abierta; el server-authoritative llega en 14b (Cloud Functions).
 */
export function debeAutoIniciar(
  sesion: Pick<Sesion, "estado" | "scheduledStart">,
  now: number,
): boolean {
  return (
    sesion.estado === "programada" &&
    now >= sesion.scheduledStart + GRACIA_AUTO_INICIO_MIN * 60_000
  );
}

/** Construye la sesión (proyección) desde una reserva. PURO, SIN datos de pago. */
export function sesionDesdeReserva(
  reserva: Reserva,
  productorId: string,
): NewSesion {
  return {
    reservaId: reserva.id,
    productorId,
    uid: reserva.uid,
    clientName: reserva.clientName,
    serviceName: reserva.serviceName,
    sede: reserva.sede,
    scheduledStart: reserva.start,
    scheduledEnd: reserva.start + reserva.durationMin * 60_000,
  };
}

// ── Máquina de estados (spine del negocio) ──────────────────────────
// Transiciones permitidas. El cliente solo dispara pendiente_pago →
// pago_en_revision (subir comprobante); el resto las hace admin/productor.
const RESERVA_TRANSITIONS: Record<ReservaEstado, ReservaEstado[]> = {
  pendiente_pago: ["pago_en_revision", "cancelada", "expirada"],
  pago_en_revision: ["confirmada", "pendiente_pago", "cancelada"],
  confirmada: ["en_curso", "cancelada"],
  en_curso: ["completada"],
  completada: [],
  cancelada: [],
  expirada: [],
};

/** Estados a los que se puede pasar desde `estado`. */
export function nextReservaStates(estado: ReservaEstado): ReservaEstado[] {
  return RESERVA_TRANSITIONS[estado];
}

/** ¿Es válida la transición `from → to`? */
export function canReservaTransition(
  from: ReservaEstado,
  to: ReservaEstado,
): boolean {
  return RESERVA_TRANSITIONS[from].includes(to);
}

/** ¿La reserva sigue viva (no terminal)? Útil para ocupar/liberar el slot. */
export function isReservaActiva(estado: ReservaEstado): boolean {
  return (
    estado !== "completada" && estado !== "cancelada" && estado !== "expirada"
  );
}
