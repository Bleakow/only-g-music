import { describe, it, expect } from "vitest";
import { badgeClass, fechaCorta } from "./estados";

describe("badgeClass (color por familia de estado)", () => {
  it("pendiente → ámbar", () => {
    expect(badgeClass("pendiente")).toContain("amber");
    expect(badgeClass("pendiente_pago")).toContain("amber");
  });
  it("estados 'vivos' → esmeralda, y los alias comparten la misma clase", () => {
    expect(badgeClass("confirmada")).toContain("emerald");
    expect(badgeClass("confirmada")).toBe(badgeClass("completada"));
    expect(badgeClass("confirmada")).toBe(badgeClass("en_curso"));
  });
  it("estados terminales negativos → rojo", () => {
    expect(badgeClass("cancelada")).toContain("red");
    expect(badgeClass("expirada")).toContain("red");
  });
  it("en revisión / cotizada → azul (sky)", () => {
    expect(badgeClass("pago_en_revision")).toContain("sky");
    expect(badgeClass("cotizada")).toContain("sky");
  });
  it("estado desconocido → clase por defecto (silver)", () => {
    expect(badgeClass("lo_que_sea")).toContain("silver");
  });
});

describe("fechaCorta", () => {
  it("formatea día / mes-corto / año en el locale dado", () => {
    const ms = new Date(2024, 0, 15).getTime();
    expect(fechaCorta(ms, "en-US")).toBe("Jan 15, 2024");
    expect(fechaCorta(ms, "es")).toContain("2024");
  });
});
