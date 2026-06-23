/**
 * Catálogo de métodos de pago (informativos: el cliente paga por fuera y sube el
 * comprobante; no hay pasarela). Las ETIQUETAS están en i18n (`chat.metodos.*`);
 * aquí viven los DATOS no traducibles para pagar.
 *
 * TODO(Only G): reemplazar los `datos` PLACEHOLDER por los reales (número Nequi,
 * cuenta Bancolombia, Llave) y, si se quiere, una `qrUrl` por método.
 */
import type { PagoMetodo } from "@/domain/conversation";

export interface MetodoPagoInfo {
  id: PagoMetodo;
  /** Dato para pagar (número/cuenta). PLACEHOLDER hasta cargar los reales. */
  datos: string;
  /** URL de un QR de pago, opcional. */
  qrUrl?: string;
  /**
   * Solo disponible para tiers altos (efectivo en el estudio). El gating por
   * tier de membresía se aplica en el Slice D; aquí solo se marca.
   */
  soloTierAlto?: boolean;
}

export const METODOS_PAGO: MetodoPagoInfo[] = [
  { id: "nequi", datos: "PLACEHOLDER — número Nequi" },
  { id: "bancolombia", datos: "PLACEHOLDER — cuenta Bancolombia" },
  { id: "llave", datos: "PLACEHOLDER — Llave (clave de pago)" },
  {
    id: "efectivo",
    datos: "PLACEHOLDER — paga en el estudio al llegar",
    soloTierAlto: true,
  },
];

/** Busca la info de un método por su id. */
export function metodoPagoInfo(id: PagoMetodo): MetodoPagoInfo | undefined {
  return METODOS_PAGO.find((m) => m.id === id);
}
