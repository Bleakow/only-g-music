import { describe, it, expect } from "vitest";
import type { Activo, Movimiento, Pasivo } from "./contabilidad";
import type { Transaccion } from "./transaccion";
import {
  mesesTranscurridos,
  depreciacionAcumulada,
  valorEnLibros,
  enPeriodo,
  totalPasivos,
  balanceGeneral,
  estadoResultados,
} from "./contabilidad";

// Fechas construidas en hora LOCAL para que los cálculos por mes sean
// deterministas sin depender de la zona horaria de la máquina.
const ene15_2024 = new Date(2024, 0, 15).getTime();
const jul15_2024 = new Date(2024, 6, 15).getTime();
const ene15_2025 = new Date(2025, 0, 15).getTime();
const ene15_2026 = new Date(2026, 0, 15).getTime();

function activo(over: Partial<Activo> = {}): Activo {
  return {
    id: "a1",
    nombre: "Micrófono",
    categoria: "equipo_grabacion",
    valorAdquisicion: 1_200_000,
    fechaAdquisicion: ene15_2024,
    createdBy: "ceo",
    createdAt: ene15_2024,
    ...over,
  };
}

function pasivo(over: Partial<Pasivo> = {}): Pasivo {
  return {
    id: "p1",
    nombre: "Préstamo",
    categoria: "prestamo",
    monto: 100_000,
    fecha: ene15_2024,
    createdBy: "ceo",
    createdAt: ene15_2024,
    ...over,
  };
}

function tx(over: Partial<Transaccion> = {}): Transaccion {
  return {
    id: "t1",
    uid: "u1",
    clientName: "Cliente",
    concepto: "Grabación",
    amount: 100_000,
    fecha: jul15_2024,
    estado: "completada",
    fuente: "reserva",
    ...over,
  };
}

function gastoUnico(over: Partial<Movimiento> = {}): Movimiento {
  return {
    id: "m1",
    categoria: "servicios",
    concepto: "Internet",
    monto: 50_000,
    fecha: jul15_2024,
    recurrencia: "unico",
    createdBy: "ceo",
    createdAt: jul15_2024,
    ...over,
  };
}

describe("mesesTranscurridos", () => {
  it("cuenta meses completos (mismo día del mes)", () => {
    expect(mesesTranscurridos(ene15_2024, jul15_2024)).toBe(6);
  });
  it("no cuenta el mes si aún no se alcanzó el día", () => {
    const jul10 = new Date(2024, 6, 10).getTime();
    expect(mesesTranscurridos(ene15_2024, jul10)).toBe(5);
  });
  it("0 si la fecha final no es posterior", () => {
    expect(mesesTranscurridos(jul15_2024, ene15_2024)).toBe(0);
  });
});

describe("depreciacionAcumulada / valorEnLibros", () => {
  it("depreciación lineal a mitad de la vida útil", () => {
    const a = activo({ vidaUtilMeses: 12 });
    expect(depreciacionAcumulada(a, jul15_2024)).toBe(600_000); // 6/12 de 1.2M
    expect(valorEnLibros(a, jul15_2024)).toBe(600_000);
  });
  it("sin vida útil no se deprecia", () => {
    const a = activo({ vidaUtilMeses: undefined });
    expect(depreciacionAcumulada(a, jul15_2024)).toBe(0);
    expect(valorEnLibros(a, jul15_2024)).toBe(1_200_000);
  });
  it("no deprecia más allá de la vida útil (queda en el residual)", () => {
    const a = activo({ vidaUtilMeses: 12, valorResidual: 200_000 });
    expect(valorEnLibros(a, ene15_2025)).toBe(200_000); // 12 meses justos
    expect(valorEnLibros(a, ene15_2026)).toBe(200_000); // más allá: no baja
  });
  it("un bien dado de baja vale 0", () => {
    const a = activo({ vidaUtilMeses: 12, bajaAt: jul15_2024 });
    expect(valorEnLibros(a, jul15_2024)).toBe(0);
  });
});

describe("enPeriodo (rango semiabierto [desde, hasta))", () => {
  const p = { desde: ene15_2024, hasta: ene15_2025 };
  it("incluye el inicio, excluye el fin", () => {
    expect(enPeriodo(ene15_2024, p)).toBe(true);
    expect(enPeriodo(ene15_2025, p)).toBe(false);
    expect(enPeriodo(jul15_2024, p)).toBe(true);
  });
  it("null en un extremo = sin límite por ese lado", () => {
    expect(enPeriodo(ene15_2026, { desde: null, hasta: null })).toBe(true);
  });
});

describe("totalPasivos", () => {
  it("suma solo los pasivos vigentes (no saldados)", () => {
    const vivos = [
      pasivo({ id: "p1", monto: 100_000 }),
      pasivo({ id: "p2", monto: 50_000 }),
    ];
    expect(totalPasivos(vivos, jul15_2024)).toBe(150_000);

    const conSaldado = [
      pasivo({ id: "p1", monto: 100_000 }),
      pasivo({ id: "p2", monto: 50_000, saldadoAt: ene15_2024 }),
    ];
    expect(totalPasivos(conSaldado, jul15_2024)).toBe(100_000);
  });
});

describe("balanceGeneral (Activos = Pasivos + Patrimonio)", () => {
  it("cuadra por construcción, sumando los pasivos extra (payouts)", () => {
    const activos = [activo({ vidaUtilMeses: 12 })]; // libros 600.000 a jul15
    const pasivos = [pasivo({ monto: 100_000 })];
    const bg = balanceGeneral(activos, pasivos, jul15_2024, 50_000);
    expect(bg.activos).toBe(600_000);
    expect(bg.pasivos).toBe(150_000);
    expect(bg.patrimonio).toBe(450_000);
    expect(bg.patrimonio).toBe(bg.activos - bg.pasivos);
  });
});

describe("estadoResultados (P&L del periodo)", () => {
  it("ingresos − gastos, con margen y desglose por categoría", () => {
    const periodo = { desde: ene15_2024, hasta: ene15_2025 };
    const txs = [
      tx({ id: "t1", amount: 100_000, fecha: jul15_2024 }),
      tx({ id: "t2", amount: 200_000, fecha: jul15_2024 }),
      tx({ id: "t3", amount: 999_999, fecha: ene15_2026 }), // fuera del periodo
    ];
    const gastos = [gastoUnico({ monto: 50_000, fecha: jul15_2024 })];
    const pnl = estadoResultados(txs, gastos, periodo, ene15_2025);
    expect(pnl.ingresos).toBe(300_000);
    expect(pnl.gastos).toBe(50_000);
    expect(pnl.utilidad).toBe(250_000);
    expect(pnl.margen).toBeCloseTo(250_000 / 300_000);
    expect(pnl.gastosPorCategoria).toEqual([
      { categoria: "servicios", monto: 50_000, cantidad: 1 },
    ]);
  });
});
