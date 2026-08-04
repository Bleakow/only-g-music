import { describe, it, expect } from "vitest";
import {
  aCentavos,
  conversationIdDeReferencia,
  deCentavos,
  esEstadoFinal,
  estadoDeWompi,
  referenciaPago,
} from "./wompi";

describe("estadoDeWompi", () => {
  it("aprobado solo con APPROVED", () => {
    expect(estadoDeWompi("APPROVED")).toBe("aprobado");
  });

  it("anulada y error cuentan como rechazo", () => {
    // Para quien paga significan lo mismo: no se cobró.
    expect(estadoDeWompi("DECLINED")).toBe("rechazado");
    expect(estadoDeWompi("VOIDED")).toBe("rechazado");
    expect(estadoDeWompi("ERROR")).toBe("rechazado");
  });

  it("un estado DESCONOCIDO nunca aprueba", () => {
    // La regla que impide regalar membresías si Wompi añade un estado nuevo.
    expect(estadoDeWompi("PENDING")).toBe("pendiente");
    expect(estadoDeWompi("ALGO_NUEVO")).toBe("pendiente");
    expect(estadoDeWompi("")).toBe("pendiente");
    expect(estadoDeWompi("approved")).toBe("pendiente"); // sensible a mayúsculas
  });
});

describe("esEstadoFinal", () => {
  it("solo pendiente sigue abierto", () => {
    expect(esEstadoFinal("pendiente")).toBe(false);
    expect(esEstadoFinal("aprobado")).toBe(true);
    expect(esEstadoFinal("rechazado")).toBe(true);
  });
});

describe("centavos", () => {
  it("convierte pesos a centavos", () => {
    expect(aCentavos(80000)).toBe(8000000);
    expect(aCentavos(15000)).toBe(1500000);
  });

  it("redondea antes de multiplicar", () => {
    expect(aCentavos(15000.4)).toBe(1500000);
  });

  it("ida y vuelta conserva el importe", () => {
    for (const precio of [80000, 15000, 12000, 40000]) {
      expect(deCentavos(aCentavos(precio))).toBe(precio);
    }
  });
});

describe("referenciaPago", () => {
  it("mete dentro el id de la conversación", () => {
    const ref = referenciaPago("conv123", "a1b2c3");
    expect(ref).toBe("ogm-conv123-a1b2c3");
    expect(conversationIdDeReferencia(ref)).toBe("conv123");
  });

  it("sobrevive a ids con guiones", () => {
    // Los ids de Firestore pueden llevar guiones: el nonce es lo ÚLTIMO, así
    // que el corte se hace por el último guion, no por el primero.
    const ref = referenciaPago("conv-con-guiones", "xyz789");
    expect(conversationIdDeReferencia(ref)).toBe("conv-con-guiones");
  });

  it("descarta referencias que no son nuestras", () => {
    expect(conversationIdDeReferencia("otra-cosa")).toBe(null);
    expect(conversationIdDeReferencia("")).toBe(null);
  });
});
