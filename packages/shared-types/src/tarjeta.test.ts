import { describe, it, expect } from "vitest";
import { formatearNumero, marcaDeTarjeta } from "./tarjeta";

describe("marcaDeTarjeta", () => {
  it("Visa se reconoce con UN solo dígito", () => {
    // Es la única que empieza por 4, así que el logo aparece al primer tecleo.
    expect(marcaDeTarjeta("4")).toBe("visa");
    expect(marcaDeTarjeta("4242 4242 4242 4242")).toBe("visa");
  });

  it("Mastercard clásica (51-55) y el rango nuevo (2221-2720)", () => {
    expect(marcaDeTarjeta("5254 1336 7440 3564")).toBe("mastercard");
    expect(marcaDeTarjeta("55")).toBe("mastercard");
    expect(marcaDeTarjeta("2221")).toBe("mastercard");
    expect(marcaDeTarjeta("2720")).toBe("mastercard");
  });

  it("no confunde el rango nuevo con sus vecinos", () => {
    expect(marcaDeTarjeta("2220")).toBe(null);
    expect(marcaDeTarjeta("2721")).toBe(null);
    expect(marcaDeTarjeta("56")).toBe(null);
  });

  it("Amex y Diners", () => {
    expect(marcaDeTarjeta("3782 822463 10005")).toBe("amex");
    expect(marcaDeTarjeta("34")).toBe("amex");
    expect(marcaDeTarjeta("36")).toBe("diners");
    expect(marcaDeTarjeta("3005")).toBe("diners");
  });

  it("ignora espacios y basura, y aguanta el vacío", () => {
    expect(marcaDeTarjeta("")).toBe(null);
    expect(marcaDeTarjeta("   ")).toBe(null);
    expect(marcaDeTarjeta("42-42 4242")).toBe("visa");
  });
});

describe("formatearNumero", () => {
  it("agrupa de 4 en 4", () => {
    expect(formatearNumero("4242424242424242")).toBe("4242 4242 4242 4242");
  });

  it("Amex usa 4-6-5, como viene impreso en la tarjeta", () => {
    expect(formatearNumero("378282246310005")).toBe("3782 822463 10005");
  });

  it("va formateando mientras se escribe", () => {
    expect(formatearNumero("4242")).toBe("4242");
    expect(formatearNumero("42425")).toBe("4242 5");
  });

  it("recorta al largo de la marca (pegar de más no cuela)", () => {
    expect(formatearNumero("4242424242424242999")).toBe("4242 4242 4242 4242");
    expect(formatearNumero("378282246310005999")).toBe("3782 822463 10005");
  });
});
