import { describe, it, expect } from "vitest";
import {
  DEFAULTS,
  esComisionValida,
  esPrecioValido,
  esRecargoValido,
  parsePrecios,
  parseComisiones,
} from "./comercial-config";

describe("validadores", () => {
  it("esComisionValida: fracción finita en [0,1]", () => {
    expect(esComisionValida(0)).toBe(true);
    expect(esComisionValida(1)).toBe(true);
    expect(esComisionValida(0.2)).toBe(true);
    expect(esComisionValida(-0.1)).toBe(false);
    expect(esComisionValida(1.5)).toBe(false);
    expect(esComisionValida(Number.NaN)).toBe(false);
    expect(esComisionValida("0.2")).toBe(false);
  });
  it("esPrecioValido: entero > 0", () => {
    expect(esPrecioValido(40_000)).toBe(true);
    expect(esPrecioValido(0)).toBe(false);
    expect(esPrecioValido(-5)).toBe(false);
    expect(esPrecioValido(1.5)).toBe(false);
    expect(esPrecioValido("40000")).toBe(false);
  });
  it("esRecargoValido: entero >= 0 (el 0 es válido)", () => {
    expect(esRecargoValido(0)).toBe(true);
    expect(esRecargoValido(20_000)).toBe(true);
    expect(esRecargoValido(-1)).toBe(false);
    expect(esRecargoValido(1.5)).toBe(false);
  });
});

describe("parsePrecios (clampeo con fallback a DEFAULTS)", () => {
  it("doc ausente → todos los defaults", () => {
    expect(parsePrecios(undefined)).toEqual(DEFAULTS.precios);
  });
  it("respeta un precio válido y cae al default en los inválidos", () => {
    const out = parsePrecios({ precioBeat: 50_000, precioMaster: -5 });
    expect(out.precioBeat).toBe(50_000);
    expect(out.precioMaster).toBe(DEFAULTS.precios.precioMaster);
  });
  it("un recargo de 0 es válido (no cae al default)", () => {
    expect(parsePrecios({ recargoGrabacion2: 0 }).recargoGrabacion2).toBe(0);
  });
  it("un precio de 0 NO es válido y cae al default", () => {
    expect(parsePrecios({ precioBeat: 0 }).precioBeat).toBe(
      DEFAULTS.precios.precioBeat,
    );
  });
});

describe("parseComisiones", () => {
  it("doc ausente → comisionBeat default y comisionProductor sin configurar", () => {
    const out = parseComisiones(undefined);
    expect(out.comisionBeat).toBe(DEFAULTS.comisiones.comisionBeat);
    expect(out.comisionProductor).toBeUndefined();
  });
  it("incluye comisionProductor solo si es válida", () => {
    expect(parseComisiones({ comisionProductor: 0.15 }).comisionProductor).toBe(
      0.15,
    );
    expect(
      parseComisiones({ comisionProductor: 5 }).comisionProductor,
    ).toBeUndefined();
  });
  it("filtra las sedes con comisión malformada", () => {
    const out = parseComisiones({
      comisionProductorPorSede: { medellin: 0.25, bogota: 2 },
    });
    expect(out.comisionProductorPorSede).toEqual({ medellin: 0.25 });
  });
  it("si ninguna sede es válida, no incluye el mapa", () => {
    const out = parseComisiones({ comisionProductorPorSede: { x: 2 } });
    expect(out.comisionProductorPorSede).toBeUndefined();
  });
});
