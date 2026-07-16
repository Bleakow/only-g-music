/**
 * Entidad de dominio: Método de pago. Tipos + lógica PURA de disponibilidad
 * (qué método puede usar quién). Sin UI, sin Firebase, sin i18n: la pantalla de
 * pago mapea cada id a su etiqueta traducida y a su panel de indicaciones.
 *
 * Reglas de negocio (Fase 11):
 *  - `tarjeta`: visible pero "próximamente" (la pasarela aún no está integrada).
 *  - `efectivo`: pago presencial, reservado a artistas de máxima reputación
 *    (perk de confianza) → requiere insignia `diamante`.
 *  - `nequi` / `paypal`: disponibles para todos.
 */
import type { Insignia } from "./artist-profile";
import { INSIGNIAS } from "./artist-profile";

export type MetodoPago = "tarjeta" | "nequi" | "paypal" | "efectivo";

/** Orden de presentación en la pantalla de pago. */
export const METODOS_PAGO: MetodoPago[] = [
  "nequi",
  "paypal",
  "efectivo",
  "tarjeta",
];

/**
 * Agrupación de la pantalla: `tarjeta` va como opción aparte; el resto cuelga de
 * "Pago rápido". Centraliza aquí el "tarjeta es especial" para no esparcirlo por
 * la UI.
 */
export type CategoriaPago = "tarjeta" | "rapido";

export function categoriaDe(metodo: MetodoPago): CategoriaPago {
  return metodo === "tarjeta" ? "tarjeta" : "rapido";
}

/**
 * Por qué un método no está disponible (null = disponible). La UI traduce cada
 * caso a su mensaje ("Próximamente", "Requiere insignia Diamante").
 */
export type MetodoBloqueo =
  | { tipo: "proximamente" }
  | { tipo: "requiere-insignia"; insignia: Insignia };

export interface MetodoPagoEstado {
  metodo: MetodoPago;
  disponible: boolean;
  /** Motivo del bloqueo, o null si está disponible. */
  bloqueo: MetodoBloqueo | null;
}

/** Insignia mínima para pagar en efectivo (pago presencial de confianza). */
export const INSIGNIA_MIN_EFECTIVO: Insignia = "diamante";

/** ¿`insignia` alcanza al menos a `minima`? Ordena por INSIGNIAS (puro). */
function cumpleInsignia(insignia: Insignia | null, minima: Insignia): boolean {
  if (!insignia) return false;
  return INSIGNIAS.indexOf(insignia) >= INSIGNIAS.indexOf(minima);
}

/**
 * Estado de un método para un usuario según su insignia (null = sin perfil de
 * artista / sin reputación → efectivo bloqueado). Puro.
 */
export function estadoMetodo(
  metodo: MetodoPago,
  insignia: Insignia | null,
): MetodoPagoEstado {
  if (metodo === "tarjeta") {
    return { metodo, disponible: false, bloqueo: { tipo: "proximamente" } };
  }
  if (
    metodo === "efectivo" &&
    !cumpleInsignia(insignia, INSIGNIA_MIN_EFECTIVO)
  ) {
    return {
      metodo,
      disponible: false,
      bloqueo: { tipo: "requiere-insignia", insignia: INSIGNIA_MIN_EFECTIVO },
    };
  }
  return { metodo, disponible: true, bloqueo: null };
}

/** Estado de todos los métodos, en orden de presentación (puro). */
export function metodosConEstado(insignia: Insignia | null): MetodoPagoEstado[] {
  return METODOS_PAGO.map((m) => estadoMetodo(m, insignia));
}
