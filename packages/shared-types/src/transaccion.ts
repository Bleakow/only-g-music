/**
 * Entidad de dominio: Transacción contable (unidad de INGRESO). Generaliza las
 * finanzas más allá de las reservas: una reserva confirmada es una transacción,
 * y también lo es un pago de premium confirmado (chat de pago) o, a futuro, una
 * venta de producción. Tipos puros: sin UI ni Firebase aquí.
 */

/** Origen del ingreso. */
export type TransaccionFuente =
  | "reserva"
  | "premium"
  | "membresia"
  | "beat"
  | "gnotes"
  | "pase";

export interface Transaccion {
  id: string;
  /** UID de quien pagó. */
  uid: string;
  /** Nombre visible del pagador (o null). */
  clientName: string | null;
  /** Concepto (nombre del servicio, "Premium", …). */
  concepto: string;
  /** Monto en COP. */
  amount: number;
  /** Fecha del ingreso (epoch ms). */
  fecha: number;
  /** Estado a mostrar (clave de `status.*`). */
  estado: string;
  fuente: TransaccionFuente;
}
