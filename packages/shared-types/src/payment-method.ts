/**
 * Entidad de dominio: Método de pago FUERA de la pasarela.
 *
 * Queda uno solo: `efectivo`, el pago presencial en sede. Todo lo demás
 * —transferencia con comprobante, QR, llave Bre-B, Nequi a mano— se retiró
 * cuando Wompi pasó a ser la vía de cobro: cobrar por pasarela y además mantener
 * un circuito paralelo que un humano revisa a ojo significa dos verdades sobre
 * el mismo dinero, y la que se queda desactualizada siempre es la de a mano.
 *
 * El efectivo sobrevive porque la pasarela no lo cubre: alguien que aparece en el
 * estudio con billetes no tiene dónde meterlos en Wompi. Sigue siendo un perk de
 * confianza —solo para artistas de máxima reputación— porque implica fiarse de
 * que el dinero llegará: lo confirma el equipo cuando lo recibe.
 *
 * Módulo PURO: sin UI, sin Firebase, sin i18n.
 */
import type { Insignia } from "./artist-profile";
import { INSIGNIAS } from "./artist-profile";

export type MetodoPago = "efectivo";

/** Insignia mínima para pagar en sede (pago presencial de confianza). */
export const INSIGNIA_MIN_EFECTIVO: Insignia = "diamante";

/**
 * ¿Puede pagar en sede? Requiere insignia `diamante`; sin perfil de artista (o
 * sin reputación) la respuesta es no. Puro.
 */
export function puedePagarEnSede(insignia: Insignia | null | undefined): boolean {
  if (!insignia) return false;
  return INSIGNIAS.indexOf(insignia) >= INSIGNIAS.indexOf(INSIGNIA_MIN_EFECTIVO);
}
