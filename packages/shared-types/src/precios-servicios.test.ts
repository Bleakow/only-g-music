import { describe, it, expect } from "vitest";
import { DEFAULTS } from "./comercial-config";
import {
  horasSanas,
  esPersonasTier,
  recargoGrabacion,
  precioGrabacion,
  precioMezcla,
  servicioVariaPorPersonas,
  subtotalServicio,
} from "./precios-servicios";

// Probamos contra los precios por defecto del dominio (los valores históricos).
const precios = DEFAULTS.precios;

describe("horasSanas", () => {
  it("nunca baja de 2h (piso facturable)", () => {
    expect(horasSanas(1)).toBe(2);
    expect(horasSanas(0)).toBe(2);
    expect(horasSanas(-3)).toBe(2);
  });
  it("redondea al entero más cercano", () => {
    expect(horasSanas(3.4)).toBe(3);
    expect(horasSanas(3.6)).toBe(4);
  });
  it("sanea NaN a 2h", () => {
    expect(horasSanas(Number.NaN)).toBe(2);
  });
});

describe("esPersonasTier", () => {
  it("acepta los tres tramos", () => {
    expect(esPersonasTier("1")).toBe(true);
    expect(esPersonasTier("2")).toBe(true);
    expect(esPersonasTier("agrupacion")).toBe(true);
  });
  it("rechaza cualquier otra cosa", () => {
    expect(esPersonasTier("3")).toBe(false);
    expect(esPersonasTier(1)).toBe(false);
    expect(esPersonasTier(undefined)).toBe(false);
  });
});

describe("recargoGrabacion", () => {
  it("1 persona no paga recargo", () => {
    expect(recargoGrabacion("1", precios)).toBe(0);
  });
  it("2 personas y agrupación pagan su recargo", () => {
    expect(recargoGrabacion("2", precios)).toBe(precios.recargoGrabacion2);
    expect(recargoGrabacion("agrupacion", precios)).toBe(
      precios.recargoGrabacionAgrupacion,
    );
  });
});

describe("precioGrabacion", () => {
  it("2h y 1 persona = solo la base", () => {
    expect(precioGrabacion(2, "1", precios)).toBe(precios.precioGrabacionBase);
  });
  it("3h y 2 personas = base + 1 hora extra + recargo de 2", () => {
    const esperado =
      precios.precioGrabacionBase +
      precios.precioGrabacionHoraExtra +
      precios.recargoGrabacion2;
    expect(precioGrabacion(3, "2", precios)).toBe(esperado);
    expect(precioGrabacion(3, "2", precios)).toBe(95_000); // 60k + 15k + 20k
  });
  it("aplica el piso de 2h aunque pidan 1", () => {
    expect(precioGrabacion(1, "1", precios)).toBe(precios.precioGrabacionBase);
  });
});

describe("precioMezcla", () => {
  it("precio exacto por tramo", () => {
    expect(precioMezcla("1", precios)).toBe(precios.precioMezcla1);
    expect(precioMezcla("2", precios)).toBe(precios.precioMezcla2);
    expect(precioMezcla("agrupacion", precios)).toBe(
      precios.precioMezclaAgrupacion,
    );
  });
});

describe("servicioVariaPorPersonas", () => {
  it("solo grabación y mezcla varían por personas", () => {
    expect(servicioVariaPorPersonas("grabacion")).toBe(true);
    expect(servicioVariaPorPersonas("mezcla")).toBe(true);
    expect(servicioVariaPorPersonas("masterizacion")).toBe(false);
    expect(servicioVariaPorPersonas("beat")).toBe(false);
  });
});

describe("subtotalServicio (despacho por slug)", () => {
  it("grabación usa las horas (qty) y el tramo", () => {
    expect(
      subtotalServicio({
        slug: "grabacion",
        qty: 3,
        personas: "2",
        precios,
        basePrice: 0,
      }),
    ).toBe(95_000);
  });
  it("mezcla = precio del tramo × cantidad de canciones", () => {
    expect(
      subtotalServicio({
        slug: "mezcla",
        qty: 2,
        personas: "1",
        precios,
        basePrice: 0,
      }),
    ).toBe(precios.precioMezcla1 * 2);
  });
  it("masterización y beat son planos × cantidad", () => {
    expect(
      subtotalServicio({
        slug: "masterizacion",
        qty: 3,
        personas: "1",
        precios,
        basePrice: 0,
      }),
    ).toBe(precios.precioMaster * 3);
    expect(
      subtotalServicio({
        slug: "beat",
        qty: 2,
        personas: "1",
        precios,
        basePrice: 0,
      }),
    ).toBe(precios.precioBeat * 2);
  });
  it("cualquier otro slug cae al basePrice del catálogo × cantidad", () => {
    expect(
      subtotalServicio({
        slug: "renta_estudio",
        qty: 4,
        personas: "1",
        precios,
        basePrice: 50_000,
      }),
    ).toBe(200_000);
  });
  it("cantidad < 1 se sanea a 1 en los servicios por unidad", () => {
    expect(
      subtotalServicio({
        slug: "beat",
        qty: 0,
        personas: "1",
        precios,
        basePrice: 0,
      }),
    ).toBe(precios.precioBeat);
  });
});
