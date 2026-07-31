import { describe, it, expect } from "vitest";
import type { Reserva } from "@only-g/shared-types/booking";
import type { Payout } from "@only-g/shared-types/payout";
import type { Transaccion } from "@only-g/shared-types/transaccion";
import {
  netoProductorPorReserva,
  reservasATransacciones,
  ingresoTotal,
  ingresosPorMes,
  mejoresClientes,
} from "./finanzas";

function reserva(over: Partial<Reserva> = {}): Reserva {
  return {
    id: "r1",
    uid: "u1",
    serviceSlug: "grabacion",
    serviceName: "Grabación",
    sede: "medellin",
    start: new Date(2024, 1, 10).getTime(),
    durationMin: 120,
    amount: 300_000,
    clientName: "Ana",
    estado: "confirmada",
    createdAt: 0,
    ...over,
  };
}

function payout(over: Partial<Payout> = {}): Payout {
  return {
    id: "prod_1",
    acreedorUid: "prod1",
    acreedorNombre: "Productor",
    origen: "produccion",
    refId: "r1",
    monto: 80_000,
    estado: "pendiente",
    createdAt: 0,
    ...over,
  };
}

function tx(over: Partial<Transaccion> = {}): Transaccion {
  return {
    id: "t1",
    uid: "u1",
    clientName: "Ana",
    concepto: "Grabación",
    amount: 100_000,
    fecha: new Date(2024, 1, 10).getTime(),
    estado: "completada",
    fuente: "reserva",
    ...over,
  };
}

describe("netoProductorPorReserva", () => {
  it("suma solo payouts de producción, con refId y no anulados", () => {
    const m = netoProductorPorReserva([
      payout({ id: "prod_a", refId: "r1", monto: 80_000 }),
      payout({ id: "prod_b", refId: "r1", monto: 20_000 }),
      payout({ id: "beat_x", origen: "beat", refId: "c1", monto: 5_000 }),
      payout({ id: "prod_c", refId: "r2", estado: "anulado", monto: 99_999 }),
      payout({ id: "prod_d", refId: "", monto: 1_000 }),
    ]);
    expect(m.get("r1")).toBe(100_000);
    expect(m.has("r2")).toBe(false); // anulado
    expect(m.has("c1")).toBe(false); // no es de producción
  });
});

describe("reservasATransacciones (modelo NETO)", () => {
  it("ingreso Only G = amount − neto del productor; filtra las no contables", () => {
    const reservas = [
      reserva({ id: "r1", amount: 300_000, estado: "confirmada" }),
      reserva({ id: "r2", amount: 500_000, estado: "pendiente_pago" }), // no contable
      reserva({ id: "r3", amount: 0, estado: "completada" }), // sin cobro
      reserva({ id: "r4", amount: 150_000, estado: "en_curso" }), // sin payout
    ];
    const neto = new Map([["r1", 100_000]]);
    const txs = reservasATransacciones(reservas, neto);
    expect(txs.map((t) => t.id)).toEqual(["r1", "r4"]);
    expect(txs.find((t) => t.id === "r1")?.amount).toBe(200_000);
    expect(txs.find((t) => t.id === "r4")?.amount).toBe(150_000); // sin payout → amount completo
  });
});

describe("agregados de transacciones", () => {
  it("ingresoTotal suma los montos", () => {
    expect(
      ingresoTotal([tx({ amount: 200_000 }), tx({ amount: 150_000 })]),
    ).toBe(350_000);
  });
  it("ingresosPorMes agrupa por mes en orden cronológico", () => {
    const txs = [
      tx({ id: "a", amount: 100_000, fecha: new Date(2024, 1, 10).getTime() }), // 2024-02
      tx({ id: "b", amount: 50_000, fecha: new Date(2024, 1, 20).getTime() }), // 2024-02
      tx({ id: "c", amount: 30_000, fecha: new Date(2024, 0, 5).getTime() }), // 2024-01
    ];
    expect(ingresosPorMes(txs)).toEqual([
      { mes: "2024-01", total: 30_000 },
      { mes: "2024-02", total: 150_000 },
    ]);
  });
  it("mejoresClientes ordena por total desc y respeta el top", () => {
    const txs = [
      tx({ uid: "A", clientName: "Ana", amount: 100_000 }),
      tx({ uid: "A", clientName: "Ana", amount: 200_000 }),
      tx({ uid: "B", clientName: "Beto", amount: 500_000 }),
    ];
    const top = mejoresClientes(txs);
    expect(top[0]).toEqual({ uid: "B", name: "Beto", total: 500_000, count: 1 });
    expect(top[1]).toEqual({ uid: "A", name: "Ana", total: 300_000, count: 2 });
    expect(mejoresClientes(txs, 1)).toHaveLength(1);
  });
});
