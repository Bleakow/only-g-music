"use client";

import type {
  MetricEvent,
  PlaySource,
  ShareChannel,
} from "@only-g/shared-types/profile-metrics";

/**
 * Envío de métricas del perfil desde el navegador.
 *
 * REGLA DE ORO: esto es telemetría de vanidad, así que NUNCA puede estropear la
 * visita. Todo va en best-effort — si el endpoint falla, si no hay red o si el
 * navegador bloquea la petición, se ignora en silencio y el perfil sigue igual.
 *
 * Se usa `keepalive` para que el evento salga aunque el usuario navegue fuera
 * justo después (el caso típico de un clic a una red social).
 */

interface EventPayload {
  evento: MetricEvent;
  origen?: PlaySource;
  cancion?: string;
  canal?: ShareChannel;
  red?: string;
  tz?: string;
  locale?: string;
}

function send(slug: string, payload: EventPayload): void {
  if (!slug || typeof window === "undefined") return;
  void fetch(`/api/metricas/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Marca algo como "ya contado" en esta pestaña. Devuelve `false` si ya estaba.
 * Evita inflar los contadores al recargar o al volver atrás; no protege contra
 * alguien decidido (para eso haría falta login obligatorio).
 */
function once(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    // Modo incógnito estricto o storage lleno: se cuenta igual, sin dedup.
    return true;
  }
}

/** Visita al perfil: una por pestaña y por perfil. El dueño no cuenta. */
export function trackVisita(slug: string, isOwner: boolean): void {
  if (isOwner) return;
  if (!once(`ogm:visit:${slug}`)) return;
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    tz = undefined;
  }
  send(slug, {
    evento: "visita",
    tz,
    locale: typeof navigator !== "undefined" ? navigator.language : undefined,
  });
}

/**
 * Reproducción. Se cuenta UNA por tema y pestaña: si alguien deja una canción en
 * bucle, sigue siendo un oyente, no cien reproducciones.
 */
export function trackPlay(
  slug: string,
  origen: PlaySource,
  cancion?: string,
): void {
  const id = cancion?.trim() || origen;
  if (!once(`ogm:play:${slug}:${origen}:${id}`)) return;
  send(slug, { evento: "play", origen, cancion: cancion?.trim() || undefined });
}

/** Perfil compartido, con el canal por el que salió. */
export function trackShare(slug: string, canal: ShareChannel): void {
  send(slug, { evento: "share", canal });
}

/** Clic en una red social del perfil (se va a YouTube, Instagram…). */
export function trackSocialClick(slug: string, red: string): void {
  send(slug, { evento: "socialClick", red });
}
