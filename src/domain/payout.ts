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
  /**
   * Nota libre del admin (SOLO payouts MANUALES de producción, Fase 4): un texto
   * corto que describe por qué se le debe (p. ej. "mezcla EP de X"). Los payouts
   * automáticos de beat no la usan.
   */
  nota?: string;
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
  "acreedorUid" | "acreedorNombre" | "origen" | "refId" | "sede" | "nota" | "monto"
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

/** Cuenta por pagar de UNA persona: sus payouts pendientes + el total adeudado. */
export interface PayoutsPorAcreedor {
  acreedorUid: string;
  acreedorNombre: string | null;
  /** Solo los payouts PENDIENTES de esta persona. */
  payouts: Payout[];
  /** Suma del neto pendiente que se le debe. */
  total: number;
}

/**
 * Agrupa los payouts PENDIENTES por persona (acreedor) con su total adeudado, para
 * el panel de liquidación por-persona. Ordena por total DESC (a quién se le debe
 * más, primero — el orden natural para liquidar). Ignora los ya pagados (no son
 * cuenta por pagar). Puro: la UI inyecta la lista.
 */
export function agruparPayoutsPendientes(
  payouts: Payout[],
): PayoutsPorAcreedor[] {
  const map = new Map<string, PayoutsPorAcreedor>();
  for (const p of payouts) {
    if (p.estado !== "pendiente") continue;
    const g = map.get(p.acreedorUid);
    if (g) {
      g.payouts.push(p);
      g.total += p.monto;
      // Conserva un nombre no-nulo si aparece en alguno de sus payouts.
      if (!g.acreedorNombre && p.acreedorNombre) {
        g.acreedorNombre = p.acreedorNombre;
      }
    } else {
      map.set(p.acreedorUid, {
        acreedorUid: p.acreedorUid,
        acreedorNombre: p.acreedorNombre,
        payouts: [p],
        total: p.monto,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
