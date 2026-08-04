import { describe, it, expect } from "vitest";
import {
  GALLERY_LAYOUTS,
  GALLERY_LIMIT,
  areaDeRanura,
  esGalleryLayoutId,
  intercambiar,
  layoutEfectivo,
  layoutPorDefecto,
  layoutsParaFotos,
} from "./gallery-layout";

describe("catálogo de plantillas", () => {
  it("cubre TODOS los tamaños de galería posibles (1..LIMIT)", () => {
    // Si un tamaño se queda sin plantilla, esa galería no se puede pintar.
    for (let n = 1; n <= GALLERY_LIMIT; n++) {
      expect(layoutsParaFotos(n).length).toBeGreaterThan(0);
    }
  });

  it("ninguna plantilla pide más fotos de las que se admiten", () => {
    for (const l of GALLERY_LAYOUTS) {
      expect(l.slots).toBeGreaterThan(0);
      expect(l.slots).toBeLessThanOrEqual(GALLERY_LIMIT);
    }
  });

  it("no hay ids repetidos", () => {
    const ids = GALLERY_LAYOUTS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cero fotos no compone nada", () => {
    expect(layoutsParaFotos(0)).toEqual([]);
    expect(layoutPorDefecto(0)).toBeNull();
  });
});

describe("layoutEfectivo", () => {
  it("respeta la plantilla elegida si sigue sirviendo", () => {
    expect(layoutEfectivo("franja", 5)).toBe("franja");
  });

  it("cae a la de por defecto si la elegida ya no cuadra", () => {
    // Tenía 5 fotos con "franja" y borró una: "franja" no compone 4.
    expect(layoutEfectivo("franja", 4)).toBe(layoutPorDefecto(4));
  });

  it("sin elección, la de por defecto", () => {
    expect(layoutEfectivo(null, 3)).toBe(layoutPorDefecto(3));
    expect(layoutEfectivo(undefined, 6)).toBe(layoutPorDefecto(6));
  });

  it("un id inventado no rompe nada", () => {
    expect(layoutEfectivo("noexiste" as never, 4)).toBe(layoutPorDefecto(4));
  });

  it("sin fotos no hay plantilla", () => {
    expect(layoutEfectivo("mosaico", 0)).toBeNull();
  });
});

describe("areaDeRanura", () => {
  it("da una letra distinta por ranura, hasta el límite", () => {
    const areas = Array.from({ length: GALLERY_LIMIT }, (_, i) =>
      areaDeRanura(i),
    );
    expect(new Set(areas).size).toBe(GALLERY_LIMIT);
    expect(areas.every(Boolean)).toBe(true);
  });
});

describe("intercambiar", () => {
  it("cambia las dos de sitio y deja el resto quieto", () => {
    expect(intercambiar(["a", "b", "c", "d"], 0, 2)).toEqual([
      "c",
      "b",
      "a",
      "d",
    ]);
  });

  it("no muta el original", () => {
    const orig = ["a", "b"];
    intercambiar(orig, 0, 1);
    expect(orig).toEqual(["a", "b"]);
  });

  it("índices iguales o fuera de rango: devuelve lo mismo", () => {
    const orig = ["a", "b"];
    expect(intercambiar(orig, 1, 1)).toBe(orig);
    expect(intercambiar(orig, -1, 0)).toBe(orig);
    expect(intercambiar(orig, 0, 5)).toBe(orig);
  });
});

describe("esGalleryLayoutId", () => {
  it("acepta los del catálogo y rechaza el resto", () => {
    expect(esGalleryLayoutId("mosaico")).toBe(true);
    expect(esGalleryLayoutId("bento")).toBe(false);
    expect(esGalleryLayoutId(undefined)).toBe(false);
  });
});
