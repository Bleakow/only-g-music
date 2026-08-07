import { describe, it, expect } from "vitest";
import { MAX_REELS, columnasDeReels } from "./reels-layout";

describe("columnasDeReels", () => {
  it("una columna por reel: la fila centrada nunca deja huecos", () => {
    // Es lo que evita que dos reels parezcan una rejilla de cuatro a la que le
    // faltan dos: si hay dos, la rejilla TIENE dos columnas.
    expect(columnasDeReels(1)).toBe(1);
    expect(columnasDeReels(2)).toBe(2);
    expect(columnasDeReels(3)).toBe(3);
    expect(columnasDeReels(4)).toBe(4);
  });

  it("se acota al máximo: un perfil antiguo con más no rompe la fila", () => {
    expect(columnasDeReels(9)).toBe(MAX_REELS);
  });

  it("nunca cero columnas (una rejilla de 0 no se pinta)", () => {
    expect(columnasDeReels(0)).toBe(1);
    expect(columnasDeReels(-3)).toBe(1);
  });
});
