import { describe, it, expect } from "vitest";
import {
  activarPase,
  esPaseTipo,
  esValeId,
  paseEstado,
  tieneValesPorEntregar,
  valeEstado,
  valesDe,
  type Pase,
} from "./pase";

/** 15 de marzo de 2026, 12:00 UTC — fecha fija: los tests no dependen del reloj. */
const AHORA = Date.UTC(2026, 2, 15, 12, 0, 0);
const DIA = 86_400_000;

describe("activarPase", () => {
  it("el lite no incluye vales", () => {
    const p = activarPase("lite", AHORA);
    expect(p.produccion).toBeUndefined();
    expect(p.video).toBeUndefined();
    expect(valesDe(p)).toEqual([]);
  });

  it("el golden incluye producción de solista; el premium, de grupo + video", () => {
    expect(activarPase("golden", AHORA).produccion?.alcance).toBe("artista");
    const premium = activarPase("premium", AHORA);
    expect(premium.produccion?.alcance).toBe("grupo");
    expect(premium.video?.usado).toBe(false);
  });

  it("la cortesía se marca (no genera asiento contable)", () => {
    expect(activarPase("lite", AHORA, true).cortesia).toBe(true);
    expect(activarPase("lite", AHORA).cortesia).toBeUndefined();
  });
});

describe("paseEstado", () => {
  it("distingue ninguno / activo / expirado", () => {
    expect(paseEstado(null, AHORA)).toBe("ninguno");
    const p = activarPase("golden", AHORA);
    expect(paseEstado(p, AHORA)).toBe("activo");
    expect(paseEstado(p, p.expiresAt + DIA)).toBe("expirado");
  });
});

describe("valeEstado", () => {
  it("pendiente mientras nadie lo pide", () => {
    expect(valeEstado({ usado: false })).toBe("pendiente");
  });

  it("reclamado cuando el dueño abrió el hilo", () => {
    expect(valeEstado({ usado: false, reclamadoAt: AHORA })).toBe("reclamado");
  });

  it("entregado manda sobre reclamado", () => {
    expect(valeEstado({ usado: true, reclamadoAt: AHORA })).toBe("entregado");
  });
});

describe("valesDe", () => {
  it("solo lista los vales que el pase incluye", () => {
    expect(valesDe(activarPase("lite", AHORA))).toHaveLength(0);
    expect(valesDe(activarPase("golden", AHORA)).map((v) => v.id)).toEqual([
      "produccion",
    ]);
    expect(valesDe(activarPase("premium", AHORA)).map((v) => v.id)).toEqual([
      "produccion",
      "video",
    ]);
  });

  it("arrastra alcance y marcas de tiempo", () => {
    const pase: Pase = {
      ...activarPase("premium", AHORA),
      produccion: { alcance: "grupo", usado: true, entregadoAt: AHORA },
      video: { usado: false, reclamadoAt: AHORA },
    };
    const [produccion, video] = valesDe(pase);
    expect(produccion).toMatchObject({
      alcance: "grupo",
      estado: "entregado",
      entregadoAt: AHORA,
    });
    expect(video).toMatchObject({ estado: "reclamado", reclamadoAt: AHORA });
  });

  it("un pase sin pase (null) no revienta", () => {
    expect(valesDe(null)).toEqual([]);
    expect(tieneValesPorEntregar(undefined)).toBe(false);
  });
});

describe("tieneValesPorEntregar", () => {
  it("es falso cuando todo está entregado", () => {
    const pase: Pase = {
      ...activarPase("premium", AHORA),
      produccion: { alcance: "grupo", usado: true },
      video: { usado: true },
    };
    expect(tieneValesPorEntregar(pase)).toBe(false);
  });

  it("es cierto si queda alguno sin entregar, aunque esté reclamado", () => {
    const pase: Pase = {
      ...activarPase("premium", AHORA),
      produccion: { alcance: "grupo", usado: true },
      video: { usado: false, reclamadoAt: AHORA },
    };
    expect(tieneValesPorEntregar(pase)).toBe(true);
  });
});

describe("guardarraíles de datos crudos", () => {
  it("esPaseTipo y esValeId rechazan lo que no reconocen", () => {
    expect(esPaseTipo("golden")).toBe(true);
    expect(esPaseTipo("oro")).toBe(false);
    expect(esValeId("video")).toBe(true);
    expect(esValeId("mezcla")).toBe(false);
  });
});
