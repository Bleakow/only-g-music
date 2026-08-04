import { describe, it, expect } from "vitest";
import { isFinderModule, clampLogoRatio } from "./qr-art";

// Tamaño de un QR versión 2 (el típico para una URL corta de perfil).
const SIZE = 25;

describe("isFinderModule", () => {
  it("reconoce las tres esquinas completas (7×7)", () => {
    expect(isFinderModule(0, 0, SIZE)).toBe(true);
    expect(isFinderModule(6, 6, SIZE)).toBe(true);
    expect(isFinderModule(0, SIZE - 1, SIZE)).toBe(true);
    expect(isFinderModule(SIZE - 1, 0, SIZE)).toBe(true);
  });

  it("la esquina inferior derecha NO lleva patrón de búsqueda", () => {
    // Es la regla que distingue un QR de un código cualquiera: solo hay TRES.
    expect(isFinderModule(SIZE - 1, SIZE - 1, SIZE)).toBe(false);
  });

  it("deja fuera el módulo contiguo a la esquina", () => {
    expect(isFinderModule(7, 7, SIZE)).toBe(false);
    expect(isFinderModule(0, 7, SIZE)).toBe(false);
    expect(isFinderModule(7, 0, SIZE)).toBe(false);
  });

  it("no marca el centro del código", () => {
    expect(isFinderModule(12, 12, SIZE)).toBe(false);
  });
});

describe("clampLogoRatio", () => {
  it("acota el hueco al máximo que la corrección H tolera", () => {
    expect(clampLogoRatio(0.9)).toBe(0.26);
    expect(clampLogoRatio(0.26)).toBe(0.26);
  });

  it("respeta los huecos pequeños", () => {
    expect(clampLogoRatio(0.2)).toBe(0.2);
  });

  it("sin hueco (o con un valor absurdo) devuelve 0", () => {
    expect(clampLogoRatio(0)).toBe(0);
    expect(clampLogoRatio(-1)).toBe(0);
    expect(clampLogoRatio(Number.NaN)).toBe(0);
  });
});
