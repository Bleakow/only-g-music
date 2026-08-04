import { describe, it, expect } from "vitest";
import { INSIGNIA_MIN_EFECTIVO, puedePagarEnSede } from "./payment-method";

describe("puedePagarEnSede", () => {
  it("solo a partir de la insignia mínima", () => {
    expect(puedePagarEnSede("diamante")).toBe(true);
    expect(puedePagarEnSede("oro")).toBe(false);
    expect(puedePagarEnSede("plata")).toBe(false);
  });

  it("sin perfil de artista, no", () => {
    // Un cliente que no es artista no tiene insignia: paga por pasarela.
    expect(puedePagarEnSede(null)).toBe(false);
    expect(puedePagarEnSede(undefined)).toBe(false);
  });

  it("la insignia mínima es la máxima del sistema (perk de confianza)", () => {
    expect(INSIGNIA_MIN_EFECTIVO).toBe("diamante");
  });
});
