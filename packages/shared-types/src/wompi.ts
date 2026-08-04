/**
 * Entidad de dominio: PAGO CON WOMPI (§09 del OGM.pen).
 *
 * Es la vía normal de cobro. Convive con el pago EN SEDE (efectivo, que confirma
 * un admin): los dos desembocan en el mismo sitio —`aplicarPagoConfirmado`, que
 * concede los derechos— y por eso este módulo NO sabe nada de derechos ni de
 * membresías. Solo traduce el vocabulario de Wompi al nuestro.
 *
 * Tipos PUROS y portables: no importar UI ni Firebase aquí.
 */

/** Estados que devuelve Wompi para una transacción. */
export type WompiStatus =
  | "PENDING"
  | "APPROVED"
  | "DECLINED"
  | "VOIDED"
  | "ERROR";

/**
 * Nuestro estado, que es lo que la UI pinta (§09: las tres tarjetas finales).
 * Wompi tiene cinco estados y nosotros tres: `VOIDED` (anulada) y `ERROR` se
 * cuentan como rechazo porque para el artista significan lo mismo — no pagó y
 * no se le cobró.
 */
export type PagoEstado = "pendiente" | "aprobado" | "rechazado";

/** Métodos del checkout (§09). El resto de los de Wompi no se ofrecen. */
export type WompiMetodo = "CARD" | "PSE" | "NEQUI" | "BANCOLOMBIA_TRANSFER";

export const WOMPI_METODOS: WompiMetodo[] = [
  "CARD",
  "PSE",
  "NEQUI",
  "BANCOLOMBIA_TRANSFER",
];

/**
 * Traduce el estado de Wompi al nuestro.
 *
 * Un estado DESCONOCIDO cae en "pendiente", nunca en "aprobado": si mañana
 * Wompi añade un estado, lo peor que puede pasar es que un pago se quede
 * esperando a que alguien lo mire — no que se concedan derechos sin cobrar.
 */
export function estadoDeWompi(status: string): PagoEstado {
  switch (status) {
    case "APPROVED":
      return "aprobado";
    case "DECLINED":
    case "VOIDED":
    case "ERROR":
      return "rechazado";
    default:
      return "pendiente";
  }
}

/** ¿Este estado ya es definitivo (no va a cambiar solo)? */
export function esEstadoFinal(estado: PagoEstado): boolean {
  return estado !== "pendiente";
}

/**
 * Wompi trabaja en CENTAVOS y nosotros en pesos enteros. El redondeo es
 * explícito para que un precio con decimales (no debería haberlos) no mande a
 * la pasarela un importe fraccionario que rechace.
 */
export function aCentavos(pesos: number): number {
  return Math.round(pesos) * 100;
}

export function deCentavos(centavos: number): number {
  return Math.round(centavos / 100);
}

/**
 * Referencia de la transacción: es la CLAVE de todo el flujo. Viaja a Wompi,
 * vuelve en el webhook y es el id de nuestro documento, así que tiene que ser
 * única por intento (si se reusara entre reintentos, Wompi rechazaría el
 * segundo por duplicada y el usuario se quedaría sin poder pagar).
 *
 * Formato `ogm-{conversationId}-{nonce}`: lleva dentro a qué chat de pago
 * pertenece, para poder conceder los derechos desde el webhook sin una consulta.
 */
export function referenciaPago(conversationId: string, nonce: string): string {
  return `ogm-${conversationId}-${nonce}`;
}

/** Saca el id de la conversación de una referencia. `null` si no es nuestra. */
export function conversationIdDeReferencia(
  reference: string,
): string | null {
  const m = /^ogm-(.+)-([^-]+)$/.exec(reference);
  return m ? m[1] : null;
}

/**
 * Documento `wompiPagos/{reference}`. Lo escribe SOLO el servidor (la Function
 * que crea la transacción y el webhook); el cliente únicamente lo LEE para
 * saber en qué estado va su pago — de ahí salen las tres pantallas finales.
 */
export interface PagoWompi {
  /** = id del documento. */
  reference: string;
  /** Chat de pago al que pertenece (donde vive el contexto: qué se compra). */
  conversationId: string;
  /** Dueño del pago. */
  uid: string;
  /** Importe en PESOS (lo que el usuario vio). */
  monto: number;
  metodo: WompiMetodo;
  estado: PagoEstado;
  /** Id de la transacción en Wompi (para soporte y conciliación). */
  transactionId?: string;
  /** Último estado crudo recibido, tal cual, para depurar sin adivinar. */
  wompiStatus?: string;
  /** Motivo del rechazo que da la pasarela. */
  motivo?: string;
  createdAt: number;
  updatedAt?: number;
  /**
   * ¿Ya se aplicaron los derechos de este pago? Un webhook puede llegar VARIAS
   * veces (Wompi reintenta), así que sin esta marca un pago aprobado podría
   * conceder dos membresías.
   */
  aplicado?: boolean;
}
