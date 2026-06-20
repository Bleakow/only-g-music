import type { Artist } from "@/domain/artist";
import { artists } from "../data/artists";

/**
 * Capa de acceso a datos de artistas. Hoy lee de datos semilla; el día que
 * migremos a Firestore, solo cambia la implementación de estas funciones —
 * la UI no se entera (sigue llamando getAllArtists / getArtistBySlug).
 */

export async function getAllArtists(): Promise<Artist[]> {
  return artists;
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  return artists.find((artist) => artist.slug === slug) ?? null;
}

export async function getArtistSlugs(): Promise<string[]> {
  return artists.map((artist) => artist.slug);
}

/**
 * Busca artistas por nombre (para el selector de colaboradores). HOY filtra el
 * roster placeholder; el día que existan usuarios con rol "artista", esta
 * función pasará a consultar Firestore (where roles array-contains 'artista' +
 * prefijo de nombre) — la UI no se entera. `term` vacío devuelve los primeros.
 */
export async function searchArtists(
  term: string,
  max = 8,
): Promise<Artist[]> {
  const q = term.trim().toLowerCase();
  const list = q
    ? artists.filter((a) => a.name.toLowerCase().includes(q))
    : artists;
  return list.slice(0, max);
}
