/**
 * PLANTILLAS de la galería del perfil (§04).
 *
 * El modelo anterior era "cada foto elige su tamaño" (cuadrada, ancha, alta,
 * grande) sobre una rejilla de dos columnas. Sonaba flexible y era una trampa:
 * las combinaciones que no cuadraban dejaban huecos, empujaban el ancho de la
 * página y —lo peor— se veían distintas en el editor, en el perfil y en móvil,
 * porque el mismo tamaño ocupa cosas distintas según cuántas columnas haya.
 *
 * Aquí la unidad no es la foto: es el MOSAICO. El artista elige una composición
 * entre las que existen para su número de fotos, y cada foto cae en una RANURA de
 * esa composición. La geometría (qué ranura ocupa qué, cuántas columnas, qué
 * proporción) vive en CSS —`.og-gal[data-layout=…]` en globals.css—, declarada
 * dos veces por plantilla: una para contenedor estrecho y otra para ancho. Este
 * módulo solo dice QUÉ plantillas existen y cuántas fotos lleva cada una.
 *
 * Consecuencias buscadas:
 *  - No hay huecos: se elige entre plantillas cuyo nº de ranuras = nº de fotos.
 *  - No hay desbordes: las áreas están declaradas, no se calculan al vuelo.
 *  - Se ve igual en todas partes: manda el ANCHO DEL CONTENEDOR (container
 *    queries), no el del dispositivo — el editor y el perfil comparten CSS.
 *  - No hace falta scroll interno: el alto sale de la proporción de la plantilla.
 *
 * Módulo PURO: sin UI ni Firebase.
 */

/** Nº máximo de fotos de la galería. */
export const GALLERY_LIMIT = 6;

export type GalleryLayoutId =
  | "unica"
  | "duo"
  | "retrato"
  | "portada"
  | "tira"
  | "rejilla"
  | "foco"
  | "mosaico"
  | "franja"
  | "panal"
  | "revista";

export interface GalleryLayoutMeta {
  id: GalleryLayoutId;
  /** Fotos que compone esta plantilla (ni una más, ni una menos). */
  slots: number;
}

/**
 * Catálogo. El ORDEN importa: la primera de cada tamaño es la que se aplica sola
 * cuando el artista no ha elegido (o cuando sube/quita una foto y la que tenía
 * deja de servir).
 */
export const GALLERY_LAYOUTS: GalleryLayoutMeta[] = [
  { id: "unica", slots: 1 },
  { id: "duo", slots: 2 },
  { id: "retrato", slots: 2 },
  { id: "portada", slots: 3 },
  { id: "tira", slots: 3 },
  { id: "rejilla", slots: 4 },
  { id: "foco", slots: 4 },
  { id: "mosaico", slots: 5 },
  { id: "franja", slots: 5 },
  { id: "panal", slots: 6 },
  { id: "revista", slots: 6 },
];

/** Letras de área, en orden de ranura: la foto `i` ocupa `grid-area: a|b|c…`. */
export const GALLERY_AREAS = ["a", "b", "c", "d", "e", "f"] as const;

/** Área CSS de la ranura `i` (vacío si se sale del máximo — no debería). */
export function areaDeRanura(i: number): string {
  return GALLERY_AREAS[i] ?? "";
}

/** Plantillas disponibles para ese número de fotos (vacío si no hay ninguna). */
export function layoutsParaFotos(n: number): GalleryLayoutMeta[] {
  return GALLERY_LAYOUTS.filter((l) => l.slots === n);
}

/** La plantilla que se aplica sola para `n` fotos, o null si `n` no compone. */
export function layoutPorDefecto(n: number): GalleryLayoutId | null {
  return layoutsParaFotos(n)[0]?.id ?? null;
}

/**
 * Plantilla EFECTIVA: la elegida si sigue sirviendo para el número de fotos
 * actual; si no, la de por defecto. Existe porque las fotos cambian después de
 * elegir composición: subir una séptima o borrar una tercera no puede dejar el
 * mosaico con ranuras vacías (o fotos sin sitio).
 */
export function layoutEfectivo(
  elegido: GalleryLayoutId | null | undefined,
  n: number,
): GalleryLayoutId | null {
  const disponibles = layoutsParaFotos(n);
  if (elegido && disponibles.some((l) => l.id === elegido)) return elegido;
  return disponibles[0]?.id ?? null;
}

/** ¿Es un id de plantilla conocido? (guardarraíl para datos crudos). */
export function esGalleryLayoutId(v: unknown): v is GalleryLayoutId {
  return GALLERY_LAYOUTS.some((l) => l.id === v);
}

/**
 * INTERCAMBIA dos fotos de ranura (puro). Es la operación de reordenar: mover la
 * foto de la ranura A a la B manda la que estuviera en B a la A. Con mosaicos de
 * ranuras fijas es lo único que no descoloca el resto — insertar y desplazar
 * haría rotar todas las fotos por composiciones de tamaños distintos.
 */
export function intercambiar<T>(items: T[], a: number, b: number): T[] {
  if (
    a === b ||
    a < 0 ||
    b < 0 ||
    a >= items.length ||
    b >= items.length
  ) {
    return items;
  }
  const next = [...items];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
