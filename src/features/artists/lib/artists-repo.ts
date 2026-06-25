import type { Artist } from "@/domain/artist";
import { artists } from "../data/artists";
import { getVisibleProfiles } from "./artist-profile-repo";
import { profileToArtist } from "./profile-display";

/**
 * Capa de acceso a datos de artistas. La semilla (`artists`) quedó retirada
 * (vacía): `getAllArtists`/`getArtistBySlug`/`getArtistSlugs` ya no devuelven
 * placeholders. La data real vive en Firestore y la cargan los componentes
 * cliente (vitrina, menú, home). `searchArtists` SÍ consulta Firestore.
 */

export async function getAllArtists(): Promise<Artist[]> {
  return artists; // [] — la UI carga los perfiles reales en cliente
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  return artists.find((artist) => artist.slug === slug) ?? null;
}

export async function getArtistSlugs(): Promise<string[]> {
  return artists.map((artist) => artist.slug);
}

/**
 * Busca artistas REALES (perfiles visibles de Firestore) por nombre, para el
 * selector de colaboradores de una cotización. `term` vacío devuelve los
 * primeros `max`. Se llama solo desde cliente (ArtistPicker).
 */
export async function searchArtists(term: string, max = 8): Promise<Artist[]> {
  const all = (await getVisibleProfiles()).map(profileToArtist);
  const q = term.trim().toLowerCase();
  const list = q ? all.filter((a) => a.name.toLowerCase().includes(q)) : all;
  return list.slice(0, max);
}
