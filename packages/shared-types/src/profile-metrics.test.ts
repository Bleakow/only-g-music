import { describe, it, expect } from "vitest";
import {
  dayKey,
  lastDayKeys,
  mergeCounts,
  sumDays,
  rank,
  deltaPct,
  series,
  flagEmoji,
  type MetricsDay,
} from "./profile-metrics";

describe("dayKey / lastDayKeys", () => {
  it("usa UTC, no la hora local", () => {
    // 23:30 del 1 de agosto en UTC sigue siendo el día 1 aunque el visitante
    // esté en un huso donde ya sea día 2.
    expect(dayKey(new Date("2026-08-01T23:30:00Z"))).toBe("2026-08-01");
    expect(dayKey(new Date("2026-08-02T00:10:00Z"))).toBe("2026-08-02");
  });

  it("devuelve N días del más antiguo al más reciente, incluyendo hoy", () => {
    const keys = lastDayKeys(3, new Date("2026-08-03T10:00:00Z"));
    expect(keys).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  it("cruza el cambio de mes sin saltarse días", () => {
    const keys = lastDayKeys(3, new Date("2026-03-01T12:00:00Z"));
    expect(keys).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
  });
});

describe("mergeCounts", () => {
  it("suma claves comunes y conserva las nuevas", () => {
    expect(mergeCounts({ CO: 2, US: 1 }, { CO: 3, MX: 5 })).toEqual({
      CO: 5,
      US: 1,
      MX: 5,
    });
  });

  it("tolera undefined en cualquiera de los dos lados", () => {
    expect(mergeCounts(undefined, { CO: 1 })).toEqual({ CO: 1 });
    expect(mergeCounts({ CO: 1 }, undefined)).toEqual({ CO: 1 });
    expect(mergeCounts(undefined, undefined)).toEqual({});
  });

  it("no muta los mapas de entrada", () => {
    const a = { CO: 1 };
    mergeCounts(a, { CO: 9 });
    expect(a).toEqual({ CO: 1 });
  });
});

describe("sumDays", () => {
  it("agrega escalares y mapas de varios días", () => {
    const days: MetricsDay[] = [
      { dia: "2026-08-01", visitas: 10, plays: 2, porPais: { CO: 8, US: 2 } },
      { dia: "2026-08-02", visitas: 5, shares: 1, porPais: { CO: 5 } },
    ];
    const total = sumDays(days);
    expect(total.visitas).toBe(15);
    expect(total.plays).toBe(2);
    expect(total.shares).toBe(1);
    expect(total.socialClicks).toBe(0);
    expect(total.porPais).toEqual({ CO: 13, US: 2 });
  });

  it("con lista vacía devuelve todo a cero (no undefined)", () => {
    const total = sumDays([]);
    expect(total.visitas).toBe(0);
    expect(total.porPais).toEqual({});
  });
});

describe("rank", () => {
  it("ordena de mayor a menor con pct relativo al líder", () => {
    const r = rank({ CO: 50, US: 25, MX: 25 });
    expect(r.map((e) => e.key)).toEqual(["CO", "MX", "US"]); // empate → alfabético
    expect(r[0].pct).toBe(100);
    expect(r[1].pct).toBe(50);
  });

  it("share es la proporción sobre el total", () => {
    const r = rank({ A: 75, B: 25 });
    expect(r[0].share).toBeCloseTo(75);
    expect(r[1].share).toBeCloseTo(25);
  });

  it("descarta ceros y respeta el límite", () => {
    const r = rank({ A: 5, B: 0, C: 3, D: 1 }, 2);
    expect(r.map((e) => e.key)).toEqual(["A", "C"]);
  });

  it("mapa vacío o indefinido → lista vacía", () => {
    expect(rank({})).toEqual([]);
    expect(rank(undefined)).toEqual([]);
  });
});

describe("deltaPct", () => {
  it("calcula la variación entre periodos", () => {
    expect(deltaPct(120, 100)).toBe(20);
    expect(deltaPct(80, 100)).toBe(-20);
  });

  it("sin base previa devuelve null en vez de un porcentaje absurdo", () => {
    // De 0 a 5 no es "+500%": es que no hay con qué comparar.
    expect(deltaPct(5, 0)).toBeNull();
    expect(deltaPct(0, 0)).toBeNull();
  });
});

describe("series", () => {
  it("extrae una métrica por día, con 0 donde no hubo dato", () => {
    const days: MetricsDay[] = [
      { dia: "2026-08-01", visitas: 3 },
      { dia: "2026-08-02" },
    ];
    expect(series(days, "visitas")).toEqual([
      { dia: "2026-08-01", value: 3 },
      { dia: "2026-08-02", value: 0 },
    ]);
  });
});

describe("flagEmoji", () => {
  it("convierte el ISO-2 en su bandera", () => {
    expect(flagEmoji("CO")).toBe("🇨🇴");
    expect(flagEmoji("US")).toBe("🇺🇸");
    expect(flagEmoji("es")).toBe("🇪🇸"); // tolera minúsculas
  });

  it("devuelve cadena vacía con códigos inválidos", () => {
    expect(flagEmoji("XYZ")).toBe("");
    expect(flagEmoji("1")).toBe("");
    expect(flagEmoji("")).toBe("");
  });
});
