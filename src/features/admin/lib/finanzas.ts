/**
 * Cálculo de finanzas (PURO) sobre TRANSACCIONES (unidad de ingreso). Las
 * reservas confirmadas se mapean a transacciones, igual que los pagos de premium
 * confirmados (chat de pago) y, a futuro, otras ventas. Sin UI ni Firebase aquí.
 */
import type { Reserva, ReservaEstado } from "@/domain/booking";
import type { Transaccion } from "@/domain/transaccion";

const CONTABLES: ReservaEstado[] = ["confirmada", "en_curso", "completada"];

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

/** Reservas que cuentan como ingreso (pago confirmado en adelante) → transacciones. */
export function reservasATransacciones(reservas: Reserva[]): Transaccion[] {
  return reservas
    .filter((r) => CONTABLES.includes(r.estado) && (r.amount ?? 0) > 0)
    .map((r) => ({
      id: r.id,
      uid: r.uid,
      clientName: r.clientName ?? null,
      concepto: r.serviceName,
      amount: r.amount ?? 0,
      fecha: r.start,
      estado: r.estado,
      fuente: "reserva" as const,
    }));
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
      ({ uid: tx.uid, name: tx.clientName ?? "Cliente", total: 0, count: 0 } as ClienteTop);
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
