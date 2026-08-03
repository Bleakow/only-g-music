/**
 * Datos de las secciones que desbloquean las ETIQUETAS de talento (§05).
 *
 * Viven aparte de `ArtistProfile` para que ese archivo no se convierta en un
 * cajón de sastre: aquí está lo que solo existe cuando el perfil lleva cierta
 * etiqueta (ficha técnica de modelo, trayectoria de bailarín…).
 *
 * Todo es opcional y de texto libre. Es deliberado: una modelo puede medir
 * "1.74 m" o "174 cm", y su talla ser "M / 8" o "S"; encorsetarlo en números
 * obligaría a inventar unidades y a validar cosas que cambian por país.
 */

/** Ficha técnica de modelo. Los campos vacíos no se pintan. */
export interface FichaTecnica {
  altura?: string;
  medidas?: string;
  talla?: string;
  calzado?: string;
  ojos?: string;
  cabello?: string;
}

/** Orden de presentación de la ficha (el del mockup). */
export const FICHA_TECNICA_CAMPOS = [
  "altura",
  "medidas",
  "talla",
  "calzado",
  "ojos",
  "cabello",
] as const;

export type FichaTecnicaCampo = (typeof FICHA_TECNICA_CAMPOS)[number];

/** ¿Hay algo que enseñar en la ficha? Si no, la sección no se pinta vacía. */
export function fichaTieneDatos(f: FichaTecnica | undefined): boolean {
  if (!f) return false;
  return FICHA_TECNICA_CAMPOS.some((c) => (f[c] ?? "").trim().length > 0);
}

/** Un premio, portada o hito. `anio` es texto: caben "2024" y "2023-2024". */
export interface Reconocimiento {
  titulo: string;
  detalle?: string;
  anio?: string;
}

/** Un paso de la trayectoria (giras, montajes, campañas…). */
export interface TrayectoriaItem {
  titulo: string;
  detalle?: string;
  anio?: string;
}

/** Tope por lista: un perfil no es un currículum infinito. */
export const MAX_RECONOCIMIENTOS = 12;
export const MAX_TRAYECTORIA = 12;
export const MAX_MARCAS = 20;
export const MAX_CATEGORIAS = 10;

/**
 * Categorías de modelo sugeridas (el artista puede escribir las suyas). El
 * color es del CHIP, para que la fila se lea de un vistazo como en el mockup.
 */
export const CATEGORIAS_MODELO: { value: string; color: string }[] = [
  { value: "Pasarela", color: "#c4a5ff" },
  { value: "Editorial", color: "#f472b6" },
  { value: "Comercial", color: "#60a5fa" },
  { value: "Fitness", color: "#4ade80" },
  { value: "Publicidad", color: "#fbbf24" },
  { value: "Alta costura", color: "#fb7185" },
  { value: "Belleza", color: "#38bdf8" },
];

/** Géneros de baile sugeridos. */
export const GENEROS_BAILE: string[] = [
  "Urbano",
  "Salsa",
  "Afrobeat",
  "Hip Hop",
  "Dancehall",
  "Contemporáneo",
  "Bachata",
  "Champeta",
  "Reggaetón",
  "Breaking",
  "House",
  "Folclor",
];

/**
 * Color del chip de una categoría. Las que el artista escriba a mano no están
 * en la lista, así que caen a un color estable derivado del propio texto: dos
 * perfiles distintos verán "Editorial" del mismo color, y no cambiará al recargar.
 */
export function categoriaColor(value: string): string {
  const known = CATEGORIAS_MODELO.find(
    (c) => c.value.toLowerCase() === value.trim().toLowerCase(),
  );
  if (known) return known.color;
  const palette = CATEGORIAS_MODELO.map((c) => c.color);
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}
