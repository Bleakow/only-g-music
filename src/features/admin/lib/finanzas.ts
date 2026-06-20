/**
 * Cálculo de finanzas (PURO) derivado de las reservas. Una sola fuente de
 * verdad: los ingresos NO son una contabilidad aparte, salen de las reservas
 * confirmadas/en curso/completadas. Sin UI ni Firebase aquí.
 */
import type { Reserva, ReservaEstado } from "@/domain/booking";

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

/** Reservas que cuentan como ingreso (pago confirmado en adelante, con monto). */
export function reservasContables(reservas: Reserva[]): Reserva[] {
  return reservas.filter(
    (r) => CONTABLES.includes(r.estado) && (r.amount ?? 0) > 0,
  );
}

export function ingresoTotal(reservas: Reserva[]): number {
  return reservasContables(reservas).reduce((s, r) => s + (r.amount ?? 0), 0);
}

function mesDe(start: number): string {
  const d = new Date(start);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Ingresos agrupados por mes (de la fecha de la reserva), orden cronológico. */
export function ingresosPorMes(reservas: Reserva[]): IngresoMes[] {
  const map = new Map<string, number>();
  for (const r of reservasContables(reservas)) {
    const m = mesDe(r.start);
    map.set(m, (map.get(m) ?? 0) + (r.amount ?? 0));
  }
  return [...map.entries()]
    .map(([mes, total]) => ({ mes, total }))
    .sort((a, b) => (a.mes < b.mes ? -1 : 1));
}

/** Mejores clientes por monto total. */
export function mejoresClientes(reservas: Reserva[], top = 5): ClienteTop[] {
  const map = new Map<string, ClienteTop>();
  for (const r of reservasContables(reservas)) {
    const cur =
      map.get(r.uid) ??
      ({ uid: r.uid, name: r.clientName ?? "Cliente", total: 0, count: 0 } as ClienteTop);
    cur.total += r.amount ?? 0;
    cur.count += 1;
    if (r.clientName) cur.name = r.clientName;
    map.set(r.uid, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, top);
}
