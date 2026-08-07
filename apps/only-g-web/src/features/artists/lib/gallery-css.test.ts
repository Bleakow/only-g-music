import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  GALLERY_AREAS,
  GALLERY_LAYOUTS,
} from "@only-g/shared-types/gallery-layout";

/**
 * El catálogo de plantillas vive PARTIDO: el dominio dice qué plantillas hay y
 * cuántas fotos lleva cada una (`gallery-layout.ts`), y la geometría —columnas,
 * filas, proporción y qué ranura ocupa qué— se declara en CSS
 * (`.og-gal[data-layout=…]` en globals.css). Ese reparto es deliberado: el
 * navegador hace la rejilla mucho mejor que nosotros calculándola en JS.
 *
 * El precio es que la mitad del contrato no la ve TypeScript. Y falla CALLANDO:
 * si un área no es rectangular, o si las filas no cuadran con `--gal-cols`, el
 * navegador tira la declaración entera de `grid-template-areas` y las fotos se
 * colocan solas en pistas implícitas — se ve torcido, no roto, que es peor.
 *
 * Con 22 plantillas × 2 anchos son 44 rejillas escritas a mano. Esta prueba lee
 * el CSS de verdad y comprueba lo que el compilador no puede.
 */

const CSS = readFileSync(
  fileURLToPath(new URL("../../../app/globals.css", import.meta.url)),
  "utf8",
);

/** Geometría declarada de una plantilla en un bloque de CSS. */
interface Geometria {
  cols?: number;
  rows?: number;
  areas?: string[][];
}

/** Parte el CSS en el bloque ESTRECHO y el del `@container` (ancho). */
function bloques(): { estrecho: string; ancho: string } {
  const i = CSS.indexOf("@container gal (min-width: 34rem)");
  expect(i, "falta el @container de la galería").toBeGreaterThan(-1);
  return { estrecho: CSS.slice(0, i), ancho: CSS.slice(i) };
}

/** Lee la geometría declarada para `id` dentro de un bloque de CSS. */
function leer(css: string, id: string): Geometria | null {
  const re = new RegExp(
    `\\.og-gal\\[data-layout="${id}"\\]\\s*\\{([^}]*)\\}`,
    "s",
  );
  const cuerpo = re.exec(css)?.[1];
  if (!cuerpo) return null;

  const num = (prop: string): number | undefined => {
    const m = new RegExp(`--gal-${prop}:\\s*(\\d+)`).exec(cuerpo);
    return m ? Number(m[1]) : undefined;
  };
  const areasRaw = /grid-template-areas:([^;]*);/.exec(cuerpo)?.[1];
  const areas = areasRaw
    ? [...areasRaw.matchAll(/"([^"]*)"/g)].map((m) => m[1].trim().split(/\s+/))
    : undefined;

  return { cols: num("cols"), rows: num("rows"), areas };
}

/**
 * Comprueba una rejilla completa: nº de filas, nº de celdas por fila, que estén
 * exactamente las ranuras que la plantilla necesita, y que cada área sea un
 * RECTÁNGULO lleno (la regla que el navegador aplica y que, si se incumple,
 * anula la declaración sin decir nada).
 */
function verificar(
  etiqueta: string,
  slots: number,
  { cols, rows, areas }: Required<Geometria>,
) {
  expect(areas.length, `${etiqueta}: filas declaradas ≠ --gal-rows`).toBe(rows);
  for (const [i, fila] of areas.entries()) {
    expect(fila.length, `${etiqueta}: fila ${i + 1} no tiene --gal-cols`).toBe(
      cols,
    );
  }

  const esperadas = GALLERY_AREAS.slice(0, slots);
  const usadas = [...new Set(areas.flat())].sort();
  expect(usadas, `${etiqueta}: las ranuras no son las de la plantilla`).toEqual(
    [...esperadas].sort(),
  );

  // Rectangularidad: la caja que envuelve cada letra tiene que estar llena de
  // esa misma letra. Una "L" o una diagonal invalidan toda la regla en CSS.
  for (const letra of esperadas) {
    const celdas: [number, number][] = [];
    areas.forEach((fila, r) =>
      fila.forEach((c, col) => c === letra && celdas.push([r, col])),
    );
    const filas = celdas.map(([r]) => r);
    const columnas = celdas.map(([, c]) => c);
    const alto = Math.max(...filas) - Math.min(...filas) + 1;
    const ancho = Math.max(...columnas) - Math.min(...columnas) + 1;
    expect(
      celdas.length,
      `${etiqueta}: el área "${letra}" no es un rectángulo lleno`,
    ).toBe(alto * ancho);
  }
}

describe("geometría de las plantillas de galería (globals.css)", () => {
  const { estrecho, ancho } = bloques();

  it.each(GALLERY_LAYOUTS.map((l) => [l.id, l.slots] as const))(
    "«%s» compone bien en contenedor estrecho",
    (id, slots) => {
      const g = leer(estrecho, id);
      expect(g, `falta la regla de "${id}" en globals.css`).not.toBeNull();
      expect(g!.cols, `${id}: sin --gal-cols`).toBeDefined();
      expect(g!.rows, `${id}: sin --gal-rows`).toBeDefined();
      expect(g!.areas, `${id}: sin grid-template-areas`).toBeDefined();
      verificar(`${id} (estrecho)`, slots, g as Required<Geometria>);
    },
  );

  it.each(GALLERY_LAYOUTS.map((l) => [l.id, l.slots] as const))(
    "«%s» compone bien en contenedor ancho",
    (id, slots) => {
      const base = leer(estrecho, id)!;
      const wide = leer(ancho, id);
      // El bloque ancho puede no redefinir nada (solo cambiar la proporción):
      // entonces HEREDA la rejilla estrecha por cascada, y ya está verificada.
      if (!wide?.areas && wide?.cols === undefined) return;
      verificar(`${id} (ancho)`, slots, {
        cols: wide.cols ?? base.cols!,
        rows: wide.rows ?? base.rows!,
        areas: wide.areas ?? base.areas!,
      });
    },
  );

  it("cada plantilla tiene su nombre traducido en es y en", async () => {
    // Un id sin traducir pinta la RUTA de la clave en el selector del editor.
    const es = (await import("../../../../messages/es.json")).default;
    const en = (await import("../../../../messages/en.json")).default;
    for (const { id } of GALLERY_LAYOUTS) {
      expect(
        (es.profileBuilder.gallery.layouts as Record<string, string>)[id],
        `falta es.profileBuilder.gallery.layouts.${id}`,
      ).toBeTruthy();
      expect(
        (en.profileBuilder.gallery.layouts as Record<string, string>)[id],
        `falta en.profileBuilder.gallery.layouts.${id}`,
      ).toBeTruthy();
    }
  });
});
