/**
 * Cálculo de finanzas (PURO) sobre TRANSACCIONES (unidad de ingreso). Las
 * reservas confirmadas se mapean a transacciones, igual que los pagos de premium
 * confirmados (chat de pago) y, a futuro, otras ventas. Sin UI ni Firebase aquí.
 */
import type { Reserva, ReservaEstado } from "@only-g/shared-types/booking";
import type { Transaccion } from "@only-g/shared-types/transaccion";
import type { Payout } from "@only-g/shared-types/payout";

const CONTABLES: ReservaEstado[] = ["confirmada", "en_curso", "completada"];

/**
 * Mapa `bookingId → neto del productor` a partir de los payouts. El ingreso de
 * Only G por una reserva con productor = `amount − neto` (modelo NETO, igual que
 * beats: Only G solo se apunta la comisión; el neto del socio es un PASIVO, no
 * ingreso). Se deriva del payout —NO se persiste en el booking— para que el % / el
 * reparto NO queden legibles ni falsificables por el cliente (el booking es
 * cliente-legible; los payouts no). Solo cuenta los payouts AUTOMÁTICOS de
 * producción (`origen==='produccion'` con `refId`=bookingId; los manuales llevan
 * `refId` vacío y no se cruzan con una reserva) y no anulados.
 */
export function netoProductorPorReserva(
  payouts: Payout[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of payouts) {
    if (p.origen === "produccion" && p.refId && p.estado !== "anulado") {
      m.set(p.refId, (m.get(p.refId) ?? 0) + p.monto);
    }
  }
  return m;
}

export interface IngresoMes {
  mes: string; // "YYYY-MM"
  total: number;
}

export interface ClienteTop {
  uid: string;
  name: string;
  total: number;
  count: number;
}

/**
 * Reservas que cuentan como ingreso (pago confirmado en adelante) → transacciones.
 *
 * Modelo NETO (igual que beats): el ingreso de Only G por una reserva con productor
 * es `amount − neto` (la comisión), derivado del `netoPorReserva` que sale de los
 * payouts. Sin payout de producción (reserva sin productor, comisión sin fijar, o
 * neto 0) → neto 0 → ingreso = `amount` completo. El filtro sigue mirando
 * `amount>0` (una reserva cobrada). El % / reparto NO se persiste en el booking:
 * se deriva del payout (ver `netoProductorPorReserva`), invisible al cliente.
 */
export function reservasATransacciones(
  reservas: Reserva[],
  // Requerido a propósito (sin default): que el compilador obligue a todo caller a
  // pasar el mapa; olvidarlo restaría 0 y SOBRE-contaría el ingreso en silencio.
  netoPorReserva: Map<string, number>,
): Transaccion[] {
  return reservas
    .filter((r) => CONTABLES.includes(r.estado) && (r.amount ?? 0) > 0)
    .map((r) => {
      const amount = r.amount ?? 0;
      const neto = netoPorReserva.get(r.id) ?? 0;
      return {
        id: r.id,
        uid: r.uid,
        clientName: r.clientName ?? null,
        concepto: r.serviceName,
        // Ingreso Only G = amount − neto del productor (≥0 defensivo). Sin payout
        // → neto 0 → ingreso = amount completo.
        amount: Math.max(0, amount - neto),
        fecha: r.start,
        estado: r.estado,
        fuente: "reserva" as const,
      };
    });
}

export function ingresoTotal(txs: Transaccion[]): number {
  return txs.reduce((s, tx) => s + tx.amount, 0);
}

function mesDe(fecha: number): string {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Ingresos agrupados por mes, orden cronológico. */
export function ingresosPorMes(txs: Transaccion[]): IngresoMes[] {
  const map = new Map<string, number>();
  for (const tx of txs) {
    const m = mesDe(tx.fecha);
    map.set(m, (map.get(m) ?? 0) + tx.amount);
  }
  return [...map.entries()]
    .map(([mes, total]) => ({ mes, total }))
    .sort((a, b) => (a.mes < b.mes ? -1 : 1));
}

/** Mejores clientes por monto total. */
export function mejoresClientes(txs: Transaccion[], top = 5): ClienteTop[] {
  const map = new Map<string, ClienteTop>();
  for (const tx of txs) {
    const cur =
      map.get(tx.uid) ??
      ({
        uid: tx.uid,
        name: tx.clientName ?? "Cliente",
        total: 0,
        count: 0,
      } as ClienteTop);
    cur.total += tx.amount;
    cur.count += 1;
    if (tx.clientName) cur.name = tx.clientName;
    map.set(tx.uid, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, top);
}

/** Ordena las transacciones de la más reciente a la más antigua. */
export function ordenarTransacciones(txs: Transaccion[]): Transaccion[] {
  return [...txs].sort((a, b) => b.fecha - a.fecha);
}
