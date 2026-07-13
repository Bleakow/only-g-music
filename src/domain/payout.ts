/**
 * Entidad de dominio: PAYOUT (cuenta por pagar a un socio). Hace VISIBLE la
 * deuda que Only G tiene con una PERSONA (beatmaker/productor) por el NETO de
 * una venta — hasta ahora escondida en `beatSales.paidOut`. Es un PASIVO por
 * persona: entra en el Balance General mientras esté `pendiente`.
 *
 * La CREA el servidor (`confirmarPagoBeat` al confirmar la venta, o
 * `backfillPayouts` para el histórico) vía Admin SDK; el cliente nunca la
 * escribe (ver `firestore.rules`, colección `payouts`, `write: false`). Tipos
 * puros y portables — no importar UI ni Firebase aquí.
 *
 * `monto` queda CONGELADO al momento de generar el payout (es el `neto` de la
 * venta): no se recalcula si la config comercial cambia después.
 */

/** Origen del payout (de qué venta nace la deuda). */
export type PayoutOrigen = "beat" | "produccion";

/** Estado de liquidación del payout. */
export type PayoutEstado = "pendiente" | "pagado";

export interface Payout {
  /** Id DETERMINISTA: `beat_{convId}` | `prod_{...}` (idempotencia server-side). */
  id: string;
  /** LA PERSONA a quien se le debe (uid del socio acreedor). */
  acreedorUid: string;
  acreedorNombre: string | null;
  origen: PayoutOrigen;
  /** Referencia de la venta que originó la deuda: convId (beat) | sessionId (producción). */
  refId: string;
  /** Sede (solo producción; los beats no tienen sede). */
  sede?: string;
  /** El NETO adeudado en COP (parte del socio). */
  monto: number;
  estado: PayoutEstado;
  createdAt: number;
  // ── Liquidación (Fase 3, opcionales aquí) ──
  pagadoAt?: number;
  metodo?: "banco" | "nequi" | "efectivo";
  comprobanteUrl?: string;
  /** uid del admin que registró la liquidación. */
  registradoPor?: string;
}

/** Datos para generar un payout (sin id/estado/timestamps: los pone el servidor). */
export type NuevoPayout = Pick<
  Payout,
  "acreedorUid" | "acreedorNombre" | "origen" | "refId" | "sede" | "monto"
>;

/**
 * Suma del NETO de los payouts PENDIENTES (la cuenta por pagar total a socios).
 * Puro: la UI inyecta la lista. Es lo que el Balance suma a los pasivos vigentes.
 */
export function totalPayoutsPendientes(payouts: Payout[]): number {
  return payouts
    .filter((p) => p.estado === "pendiente")
    .reduce((s, p) => s + p.monto, 0);
}
