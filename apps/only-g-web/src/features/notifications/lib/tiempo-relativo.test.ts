import { describe, it, expect } from "vitest";
import { tiempoRelativo } from "./tiempo-relativo";

// Comparamos contra el MISMO Intl.RelativeTimeFormat que usa la función: así el
// test verifica la lógica de "qué unidad y qué valor elige" sin acoplarse a los
// textos exactos de cada locale (que cambian entre versiones de Node/ICU).
const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const AHORA = new Date(2024, 5, 15, 12, 0, 0).getTime();
const S = 1000;
const H = 60 * 60 * S;
const D = 24 * H;

describe("tiempoRelativo (con `ahora` inyectado → determinista)", () => {
  it("segundos", () => {
    expect(tiempoRelativo(AHORA - 30 * S, "es", AHORA)).toBe(
      rtf.format(-30, "second"),
    );
  });
  it("minutos (bucketiza por encima de 60s)", () => {
    expect(tiempoRelativo(AHORA - 90 * S, "es", AHORA)).toBe(
      rtf.format(-1, "minute"),
    );
  });
  it("horas", () => {
    expect(tiempoRelativo(AHORA - 2 * H, "es", AHORA)).toBe(
      rtf.format(-2, "hour"),
    );
  });
  it("días (ayer)", () => {
    expect(tiempoRelativo(AHORA - 1 * D, "es", AHORA)).toBe(
      rtf.format(-1, "day"),
    );
  });
  it("futuro (diferencia positiva)", () => {
    expect(tiempoRelativo(AHORA + 2 * H, "es", AHORA)).toBe(
      rtf.format(2, "hour"),
    );
  });
});
