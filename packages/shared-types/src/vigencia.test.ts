import { describe, it, expect } from "vitest";
import { extenderVigencia, restanteDe } from "./vigencia";

/** 15 de marzo de 2026, 12:00 UTC — fecha fija para que los tests no dependan del reloj. */
const AHORA = Date.UTC(2026, 2, 15, 12, 0, 0);
const DIA = 86_400_000;

describe("extenderVigencia", () => {
  it("sin vigencia previa, cuenta desde ahora", () => {
    const r = extenderVigencia(undefined, 1, AHORA);
    expect(r).toBe(new Date(Date.UTC(2026, 3, 15, 12, 0, 0)).getTime());
  });

  it("ACUMULA sobre lo que quedaba", () => {
    // Este es el caso del usuario: Lite con 12 días por delante + Golden.
    const quedan12 = AHORA + 12 * DIA;
    const r = extenderVigencia(quedan12, 1, AHORA);
    const esperado = new Date(quedan12);
    esperado.setMonth(esperado.getMonth() + 1);
    expect(r).toBe(esperado.getTime());
    // Y lo importante: termina DESPUÉS que si se hubiera calculado desde hoy.
    expect(r).toBeGreaterThan(extenderVigencia(undefined, 1, AHORA));
  });

  it("una vigencia CADUCADA no resta: cuenta desde ahora", () => {
    const caducoAyer = AHORA - 30 * DIA;
    expect(extenderVigencia(caducoAyer, 1, AHORA)).toBe(
      extenderVigencia(undefined, 1, AHORA),
    );
  });

  it("comprar dos veces seguidas suma dos meses", () => {
    const primera = extenderVigencia(null, 1, AHORA);
    const segunda = extenderVigencia(primera, 1, AHORA);
    expect(segunda).toBe(new Date(Date.UTC(2026, 4, 15, 12, 0, 0)).getTime());
  });
});

describe("restanteDe", () => {
  it("sin vigencia o caducada, no está activo", () => {
    expect(restanteDe(undefined, AHORA).activo).toBe(false);
    expect(restanteDe(AHORA - DIA, AHORA).activo).toBe(false);
    expect(restanteDe(AHORA - DIA, AHORA).totalDias).toBe(0);
  });

  it("parte en meses y días — el '1 mes 12 días' del panel", () => {
    const finDeMes = new Date(AHORA);
    finDeMes.setMonth(finDeMes.getMonth() + 1);
    const expira = finDeMes.getTime() + 12 * DIA;
    const r = restanteDe(expira, AHORA);
    expect(r.meses).toBe(1);
    expect(r.dias).toBe(12);
    expect(r.activo).toBe(true);
  });

  it("menos de un mes son solo días", () => {
    const r = restanteDe(AHORA + 5 * DIA, AHORA);
    expect(r.meses).toBe(0);
    expect(r.dias).toBe(5);
    expect(r.totalDias).toBe(5);
  });

  it("cuenta meses de CALENDARIO, no bloques de 30 días", () => {
    // De 15 de marzo a 15 de mayo son 2 meses, aunque sean 61 días.
    const dosMeses = new Date(AHORA);
    dosMeses.setMonth(dosMeses.getMonth() + 2);
    const r = restanteDe(dosMeses.getTime(), AHORA);
    expect(r.meses).toBe(2);
    expect(r.dias).toBe(0);
  });
});
