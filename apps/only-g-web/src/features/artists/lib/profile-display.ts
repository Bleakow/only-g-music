/**
 * Adaptador PURO: convierte un perfil real (`ArtistProfile`) a la forma legacy
 * `Artist` que ya consumen el grid y las cards de la vitrina, para reutilizar esa
 * UI sin tocarla. Sin UI ni Firebase.
 */
import type { Artist } from "@only-g/shared-types/artist";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";

export function profileToArtist(p: ArtistProfile): Artist {
  return {
    slug: p.slug,
    name: p.artisticName,
    tagline: p.tagline,
    genre: p.genre,
    bio: p.bio,
    image: p.photoURL,
    // Retrato vertical (art direction móvil) para las cards; ausente = usa `image`.
    imageMobile: p.photoURLMobile,
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
