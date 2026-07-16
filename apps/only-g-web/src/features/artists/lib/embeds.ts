/**
 * Helpers PUROS para construir URLs de reproductor embebido (YouTube/Spotify) a
 * partir de los links que pega el artista. Sin UI ni Firebase. El visitante
 * elige la plataforma; aquí solo traducimos el link a su URL de `embed`.
 */
import type { ProfileTrack, TrackPlatform } from "@only-g/shared-types/artist-profile";

/** watch?v=ID · youtu.be/ID · /embed/ID · /shorts/ID → URL de embed. */
export function youtubeEmbed(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

/** open.spotify.com/(track|album|playlist|episode)/ID → URL de embed. */
export function spotifyEmbed(url: string): string | null {
  const m = url.match(
    /open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode)\/(\w+)/,
  );
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}

/** Link crudo del tema en la plataforma pedida (o undefined). */
export function trackUrl(
  track: ProfileTrack,
  platform: TrackPlatform,
): string | undefined {
  return platform === "youtube" ? track.youtubeUrl : track.spotifyUrl;
}

/** URL de embed del tema en la plataforma pedida (null si no hay link válido). */
export function trackEmbed(
  track: ProfileTrack,
  platform: TrackPlatform,
): string | null {
  const url = trackUrl(track, platform);
  if (!url) return null;
  return platform === "youtube" ? youtubeEmbed(url) : spotifyEmbed(url);
}

/** Plataformas que tienen al menos un tema reproducible (para el selector). */
export function platformsDisponibles(tracks: ProfileTrack[]): TrackPlatform[] {
  const out: TrackPlatform[] = [];
  if (tracks.some((t) => t.youtubeUrl)) out.push("youtube");
  if (tracks.some((t) => t.spotifyUrl)) out.push("spotify");
  return out;
}
