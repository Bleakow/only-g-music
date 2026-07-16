/**
 * Entidad de dominio: VENTA de un beat (registro contable de la transacción).
 * La CREA el servidor (`confirmPayment` → `confirmarPagoBeat`, Cloud Function)
 * al confirmar el pago; el cliente nunca la escribe (ver `firestore.rules`,
 * colección `beatSales`). Tipos puros y portables — no importar UI ni Firebase.
 *
 * `precio`/`comision`/`neto` quedan CONGELADOS al momento de la venta (no se
 * recalculan si `PRECIO_BEAT`/`COMISION_BEAT` cambian después), para que el
 * histórico de ventas no mute con la config vigente.
 */
export interface BeatSale {
  id: string;
  /** Beat vendido. */
  beatId: string;
  /** Título del beat al momento de la venta (denormalizado). */
  beatTitulo: string;
  /** UID del beatmaker dueño (a quien se le debe el payout). */
  beatmakerUid: string;
  beatmakerNombre: string | null;
  /** UID del comprador. */
  buyerUid: string;
  buyerNombre: string | null;
  /** Lo pagado por el comprador (COP), = PRECIO_BEAT al momento de la venta. */
  precio: number;
  /** Parte de Only G (comisión). */
  comision: number;
  /** Parte del beatmaker (payout pendiente hasta `paidOut`). */
  neto: number;
  /** ¿Ya se le transfirió el `neto` al beatmaker (transferencia manual)? */
  paidOut: boolean;
  createdAt: number;
  paidOutAt?: number;
}
