/**
 * Entidad de dominio: Destino de pago — A DÓNDE va el dinero (las coordenadas
 * que el cliente necesita para pagar). Tipos + resolución PURA. Sin UI ni
 * Firebase.
 *
 * Modelo (Fase 11): hay un destino POR DEFECTO de la compañía (hoy todos los
 * pagos van ahí) y, opcionalmente, una sede puede traer su PROPIO destino
 * (override). `resolverDestinoPago` aplica "override de la sede ?? default de la
 * compañía" — la centralización de hoy sale gratis mientras ninguna sede tenga
 * override. Multi-moneda llega en una slice aparte; por ahora todo es COP.
 */
import type { MetodoPago } from "./payment-method";

export interface DestinoPago {
  /** QR de pago (imagen en Storage) — típicamente Nequi. */
  qrUrl?: string;
  /** Teléfono / número (Nequi o contacto de pago). */
  telefono?: string;
  /** Correo de contacto / cuenta. */
  correo?: string;
  /** Usuario o enlace de PayPal. */
  paypal?: string;
  /** Llave Bre-B (pago inmediato interbancario CO): número/alias que el cliente
   *  usa para transferir. Dato global de la compañía; se muestra junto al QR. */
  llaveBreB?: string;
  /** Instrucciones básicas adicionales (texto libre). */
  nota?: string;
}

/**
 * Destino efectivo para una sede: su override si lo tiene, si no el default de
 * la compañía. Es la ÚNICA fuente de la política override-vs-default (hoy:
 * todo-o-nada; un estudio que cobra aparte define su destino completo). Puro.
 */
export function resolverDestinoPago(
  override: DestinoPago | undefined,
  companyDefault: DestinoPago,
): DestinoPago {
  return override ?? companyDefault;
}

/** Qué mostrar al pagar con un método concreto, a partir del destino resuelto. */
export interface InstruccionPago {
  /** Dato copiable (número Nequi, usuario/correo PayPal). Vacío para efectivo. */
  valor?: string;
  /** QR de pago, si el destino lo trae. */
  qrUrl?: string;
  /** Llave Bre-B (si está configurada). Se muestra junto al QR con icono de llave. */
  llaveBreB?: string;
  /** Nota/instrucción libre. */
  nota?: string;
}

/**
 * Adapta el destino a lo que la UI muestra para el método elegido: el dato
 * copiable relevante (Nequi → teléfono, PayPal → usuario/correo), el QR y la
 * nota. El efectivo no tiene dato copiable (es presencial). Puro.
 */
export function instruccionPago(
  metodo: MetodoPago,
  destino: DestinoPago,
): InstruccionPago {
  // La llave Bre-B es transversal (dato global de la compañía): se ofrece con
  // cualquier método por si el cliente prefiere transferir por Bre-B.
  switch (metodo) {
    case "nequi":
      return {
        valor: destino.telefono,
        qrUrl: destino.qrUrl,
        llaveBreB: destino.llaveBreB,
        nota: destino.nota,
      };
    case "paypal":
      return {
        valor: destino.paypal ?? destino.correo,
        llaveBreB: destino.llaveBreB,
        nota: destino.nota,
      };
    default:
      // efectivo (y tarjeta, que no llega aquí): la nota y, si existe, la llave.
      return { llaveBreB: destino.llaveBreB, nota: destino.nota };
  }
}
