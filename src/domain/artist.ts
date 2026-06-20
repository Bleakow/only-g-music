/**
 * Entidad de dominio: Artista. Tipos puros y portables (reutilizables en una
 * futura app nativa). No importar nada de UI ni de Firebase aquí.
 */

export type SocialPlatform = "spotify" | "instagram" | "youtube" | "x";

export interface Track {
  title: string;
  url?: string;
}

export interface Artist {
  /** Identificador en la URL: /artists/<slug> */
  slug: string;
  name: string;
  /** Frase corta de impacto (debajo del nombre en el hero). */
  tagline: string;
  genre: string;
  bio: string;
  /** URL del retrato (placeholder por ahora). Sirve de portada y de poster del vídeo. */
  image: string;
  /** Vídeo opcional para la portada de la card; se reproduce en hover (desktop) o al centrarse en pantalla (móvil). */
  video?: string;
  /** Color de acento para teñir su página (hex). */
  accent: string;
  /** Ciudad / sede del productor (Barranquilla, Bogotá...). */
  city?: string;
  /** Rol dentro de la disquera (Productor, Artista, Beatmaker...). */
  role?: string;
  /** Si está destacado en el menú "Destacados" / sello. */
  featured?: boolean;
  socials: Partial<Record<SocialPlatform, string>>;
  topTracks: Track[];
}
