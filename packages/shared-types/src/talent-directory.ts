/**
 * Taxonomía y filtros PUROS del directorio de artistas (§03 OGM.pen). Sin UI ni
 * Firebase: solo tipos y funciones de filtrado, para reutilizar en la vitrina web
 * (filtro instantáneo en cliente) y en el endpoint de búsqueda (servidor).
 *
 * DOS EJES de filtro, ortogonales al buscador de texto/IA:
 *   1. Macro: TODOS / EN ESCENA (performers) / PRODUCCIÓN (beatmakers).
 *   2. Rol: chip por disciplina (Cantante, DJ, Bailarín, Presentador, Modelo…).
 */
import type { Artist } from "./artist";
import type { Role } from "./user";

/** Disciplinas "en escena" (talento visible/performer): el macro EN ESCENA. */
export const PERFORMER_ROLES: Role[] = [
  "artista",
  "dj",
  "bailarin",
  "presentador",
  "modelo",
];

/** Disciplinas de "producción" (tras las bambalinas): el macro PRODUCCIÓN. */
export const PRODUCTION_ROLES: Role[] = ["beatmaker", "productor"];

/** Todas las disciplinas del directorio, en orden de presentación (chips). */
export const DIRECTORY_ROLES: Role[] = [...PERFORMER_ROLES, ...PRODUCTION_ROLES];

/** Filtro macro del directorio (preset que marca un grupo de chips). */
export type MacroFilter = "todos" | "escena" | "produccion";

/** Un perfil sin disciplinas (semilla legacy) se trata como cantante. */
export function disciplinesOf(a: Pick<Artist, "disciplines">): Role[] {
  return a.disciplines && a.disciplines.length > 0
    ? a.disciplines
    : ["artista"];
}

/** ¿El artista cae en el macro filtro dado? `todos` siempre pasa. */
export function matchesMacro(
  a: Pick<Artist, "disciplines">,
  macro: MacroFilter,
): boolean {
  if (macro === "todos") return true;
  const set = macro === "escena" ? PERFORMER_ROLES : PRODUCTION_ROLES;
  return disciplinesOf(a).some((r) => set.includes(r));
}

/** ¿El artista tiene la disciplina del chip? `null` (sin chip) siempre pasa. */
export function matchesRole(
  a: Pick<Artist, "disciplines">,
  role: Role | null,
): boolean {
  if (!role) return true;
  return disciplinesOf(a).includes(role);
}

/** Minúsculas + sin acentos, para comparar de forma tolerante. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Filtro de texto instantáneo: casa si TODOS los términos del query aparecen en
 * el nombre, género, ciudad o tagline del artista (tolerante a acentos). Un query
 * vacío pasa a todos. Puro — es el filtro de cliente, NO la búsqueda IA.
 */
export function matchesQuery(
  a: Pick<Artist, "name" | "genre" | "city" | "tagline">,
  query: string,
): boolean {
  const q = normalizeText(query.trim());
  if (!q) return true;
  const haystack = normalizeText(
    [a.name, a.genre, a.city, a.tagline].filter(Boolean).join(" "),
  );
  return q.split(/\s+/).every((term) => haystack.includes(term));
}
