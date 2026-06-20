/**
 * Adaptador PURO entre el artista semilla (legacy `Artist`) y el modelo de
 * perfil (`ArtistProfile`). Permite reusar la misma vista de CV mientras no
 * existan perfiles reales en Firestore. Sin UI ni Firebase.
 */
import type { Artist } from "@/domain/artist";
import type { ArtistProfile } from "@/domain/artist-profile";

/** De dónde sale el perfil mostrado: real (Firestore) o muestra (semilla). */
export type ProfileSource = "firestore" | "seed";

/**
 * Convierte un artista semilla al modelo de perfil. Los temas semilla solo
 * tienen título (sin links), así que no son reproducibles: la vista los muestra
 * como lista simple. La trayectoria queda desconocida (0 → la vista la oculta).
 */
export function artistToProfile(artist: Artist): ArtistProfile {
  const now = Date.now();
  return {
    slug: artist.slug,
    uid: "",
    artisticName: artist.name,
    tagline: artist.tagline,
    genre: artist.genre,
    city: artist.city,
    bio: artist.bio,
    accent: artist.accent,
    photoURL: artist.image,
    gallery: [],
    tracks: artist.topTracks.map((t) => ({ title: t.title })),
    socials: artist.socials,
    trajectoryStartYear: 0,
    puntos: 0,
    premium: null,
    createdAt: now,
    updatedAt: now,
  };
}
