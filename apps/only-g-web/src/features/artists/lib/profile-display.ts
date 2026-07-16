/**
 * Adaptador PURO: convierte un perfil real (`ArtistProfile`) a la forma legacy
 * `Artist` que ya consumen el grid y las cards de la vitrina, para reutilizar esa
 * UI sin tocarla. Sin UI ni Firebase.
 */
import type { Artist } from "@/domain/artist";
import type { ArtistProfile } from "@/domain/artist-profile";

export function profileToArtist(p: ArtistProfile): Artist {
  return {
    slug: p.slug,
    name: p.artisticName,
    tagline: p.tagline,
    genre: p.genre,
    bio: p.bio,
    image: p.photoURL,
    accent: p.accent,
    city: p.city,
    role: "Artista",
    featured: p.featured ?? false,
    // Se conservan para segmentar la vitrina (pestaña Cantantes / Beatmakers).
    disciplines: p.disciplines,
    socials: p.socials,
    topTracks: p.tracks.map((t) => ({ title: t.title })),
  };
}
