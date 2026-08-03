/**
 * Estadísticas sociales del perfil: lee seguidores de las redes con API pública
 * fácil (YouTube subs, Spotify followers) y arma la ficha `socialStats`. Server-only.
 * IG/TikTok/X exigen OAuth → llegan después. Best-effort: una red que falla no tumba
 * al resto ni al trigger.
 *
 * Solo importa TIPOS de shared-types (functions se compila sin bundler).
 */
import type { SocialStats } from "@only-g/shared-types/artist-profile";
import type { SocialPlatform } from "@only-g/shared-types/artist";

export interface SocialKeys {
  youtubeApiKey?: string;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
}

// ── Spotify ──────────────────────────────────────────────────────────────────

/** Token de app (client_credentials) para la Web API de Spotify. */
async function spotifyToken(id: string, secret: string): Promise<string | null> {
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization:
          "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/** ID de artista desde una URL de Spotify (soporta el prefijo `intl-xx/`). */
function spotifyArtistId(url: string): string | null {
  const m = url.match(/spotify\.com\/(?:intl-[a-z]{2}\/)?artist\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

async function spotifyFollowers(
  url: string,
  token: string,
): Promise<number | null> {
  const id = spotifyArtistId(url);
  if (!id) return null;
  try {
    const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { followers?: { total?: number } };
    const n = data.followers?.total;
    return typeof n === "number" ? n : null;
  } catch {
    return null;
  }
}

// ── YouTube ──────────────────────────────────────────────────────────────────

/** Parámetro de canal desde una URL de YouTube: id / forHandle / forUsername. */
function youtubeChannelParam(
  url: string,
): { key: string; value: string } | null {
  const channel = url.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (channel) return { key: "id", value: channel[1] };
  const handle =
    url.match(/youtube\.com\/@([\w.-]+)/) || url.match(/^\s*@([\w.-]+)\s*$/);
  if (handle) return { key: "forHandle", value: "@" + handle[1] };
  const user = url.match(/youtube\.com\/user\/([\w-]+)/);
  if (user) return { key: "forUsername", value: user[1] };
  return null;
}

/** Suscriptores + vistas totales del canal (una sola llamada a la Data API). */
async function youtubeStats(
  url: string,
  apiKey: string,
): Promise<{ subscribers: number | null; views: number | null }> {
  const empty = { subscribers: null, views: null };
  const param = youtubeChannelParam(url);
  if (!param) return empty;
  try {
    const api = `https://www.googleapis.com/youtube/v3/channels?part=statistics&${param.key}=${encodeURIComponent(param.value)}&key=${apiKey}`;
    const res = await fetch(api, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      items?: {
        statistics?: {
          subscriberCount?: string;
          hiddenSubscriberCount?: boolean;
          viewCount?: string;
        };
      }[];
    };
    const stats = data.items?.[0]?.statistics;
    if (!stats) return empty;
    const subs = Number(stats.subscriberCount);
    const views = Number(stats.viewCount);
    return {
      subscribers:
        !stats.hiddenSubscriberCount && Number.isFinite(subs) ? subs : null,
      views: Number.isFinite(views) ? views : null,
    };
  } catch {
    return empty;
  }
}

// ── Ficha ────────────────────────────────────────────────────────────────────

/**
 * Arma `socialStats` a partir de las redes del perfil y las keys disponibles.
 * `null` si no se pudo leer NINGUNA red (entonces no se escribe nada).
 */
export async function buildSocialStats(
  socials: Record<string, unknown> | undefined,
  keys: SocialKeys,
  now: number,
): Promise<SocialStats | null> {
  const followers: Partial<Record<SocialPlatform, number>> = {};
  const sources: SocialPlatform[] = [];
  let plays: number | undefined;

  const yt = typeof socials?.youtube === "string" ? socials.youtube : "";
  if (yt && keys.youtubeApiKey) {
    const s = await youtubeStats(yt, keys.youtubeApiKey);
    if (s.subscribers != null) {
      followers.youtube = s.subscribers;
      sources.push("youtube");
    }
    if (s.views != null) plays = s.views; // reproducciones = vistas totales del canal
  }

  const sp = typeof socials?.spotify === "string" ? socials.spotify : "";
  if (sp && keys.spotifyClientId && keys.spotifyClientSecret) {
    const token = await spotifyToken(keys.spotifyClientId, keys.spotifyClientSecret);
    if (token) {
      const n = await spotifyFollowers(sp, token);
      if (n != null) {
        followers.spotify = n;
        sources.push("spotify");
      }
    }
  }

  if (sources.length === 0 && plays == null) return null;
  const followersTotal = sources.reduce((s, p) => s + (followers[p] ?? 0), 0);
  return {
    followers,
    followersTotal,
    sources,
    updatedAt: now,
    ...(plays != null ? { plays } : {}),
  };
}
