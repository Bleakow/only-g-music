/**
 * Cálculo de precios de los servicios de estudio (compra directa). PURO: sin UI
 * ni Firebase. Toma la config `Precios` (editable por el CEO) y devuelve montos.
 *
 * Modelo (confirmado con el negocio):
 *  - GRABACIÓN (por horas): base que cubre 2h + (horas-2) × horaExtra + recargo
 *    según el nº de personas (0 para 1, `recargoGrabacion2`, `recargoGrabacionAgrupacion`).
 *  - MEZCLA (por canción): PRECIO EXACTO por tramo de personas (1 / 2 / agrupación).
 *  - MASTER y BEAT: precio plano (no varían por personas).
 */
import type { Precios } from "./comercial-config";

/** Tramo de personas que graban/mezclan un tema. Fija el precio por tramo. */
export type PersonasTier = "1" | "2" | "agrupacion";

export const PERSONAS_TIERS: PersonasTier[] = ["1", "2", "agrupacion"];

/** Horas mínimas facturables de una sesión de grabación (la "base" cubre estas). */
export const HORAS_MIN_GRABACION = 2;

/** ¿El valor es un tramo de personas válido? */
export function esPersonasTier(v: unknown): v is PersonasTier {
  return v === "1" || v === "2" || v === "agrupacion";
}

/** Normaliza las horas a un entero >= mínimo (nunca se factura menos de 2h). */
export function horasSanas(horas: number): number {
  const h = Math.round(Number(horas) || 0);
  return Math.max(HORAS_MIN_GRABACION, h);
}

/** Recargo de grabación según el tramo de personas (0 para 1 persona). */
export function recargoGrabacion(
  personas: PersonasTier,
  precios: Precios,
): number {
  if (personas === "2") return precios.recargoGrabacion2;
  if (personas === "agrupacion") return precios.recargoGrabacionAgrupacion;
  return 0;
}

/**
 * Precio de una sesión de GRABACIÓN: base (cubre 2h) + horas extra + recargo por
 * personas. Ej: 3h, 2 personas = base + 1×horaExtra + recargoGrabacion2.
 */
export function precioGrabacion(
  horas: number,
  personas: PersonasTier,
  precios: Precios,
): number {
  const h = horasSanas(horas);
  const extra = (h - HORAS_MIN_GRABACION) * precios.precioGrabacionHoraExtra;
  return precios.precioGrabacionBase + extra + recargoGrabacion(personas, precios);
}

/** Precio de MEZCLA por canción según el tramo (precio exacto por tramo). */
export function precioMezcla(personas: PersonasTier, precios: Precios): number {
  if (personas === "2") return precios.precioMezcla2;
  if (personas === "agrupacion") return precios.precioMezclaAgrupacion;
  return precios.precioMezcla1;
}

/** ¿El servicio (por slug) cambia su precio según el nº de personas? */
export function servicioVariaPorPersonas(slug: string): boolean {
  return slug === "grabacion" || slug === "mezcla";
}

/**
 * Subtotal de una línea de compra según el servicio. Centraliza el despacho por
 * slug: grabación/mezcla/master/beat leen de `Precios`; el resto (renta de
 * estudio por horas/día, etc.) cae al `basePrice` del catálogo × cantidad.
 * `qty` = horas (grabación) o unidades/canciones/días (los demás).
 */
export function subtotalServicio(params: {
  slug: string;
  qty: number;
  personas: PersonasTier;
  precios: Precios;
  basePrice: number;
}): number {
  const { slug, qty, personas, precios, basePrice } = params;
  const n = Math.max(1, Math.round(Number(qty) || 0));
  switch (slug) {
    case "grabacion":
      return precioGrabacion(qty, personas, precios);
    case "mezcla":
      return precioMezcla(personas, precios) * n;
    case "masterizacion":
      return precios.precioMaster * n;
    case "beat":
      return precios.precioBeat * n;
    default:
      return basePrice * n;
  }
}
