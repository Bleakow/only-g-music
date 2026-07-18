/**
 * Bus mínimo "un solo audio a la vez" para el perfil de artista.
 *
 * El perfil tiene dos fuentes de sonido que NO comparten estado y viven en
 * árboles distintos: la canción de intro (`ProfileAudioPlayer`, un `<audio>`
 * nativo) y los temas destacados (`TrackPlayers`, embeds `<iframe>` de
 * YouTube/Spotify que son cross-origin y no se pueden pausar por JS).
 *
 * La coordinación es por ACCIÓN, no por evento de reproducción real (imposible
 * de leer en un iframe externo): cuando una fuente reclama el turno, las demás
 * se enteran y se detienen —el `<audio>` se pausa; el iframe se colapsa, lo que
 * corta su sonido al desmontarse—. Es un singleton de módulo a propósito: así
 * funciona aunque una de las fuentes se renderice en un portal.
 */
export type AudioSource = "profile" | "track";

let current: AudioSource | null = null;
const listeners = new Set<(active: AudioSource) => void>();

/** Una fuente toma el turno: notifica a las demás para que se detengan. */
export function claimAudio(source: AudioSource): void {
  if (current === source) return;
  current = source;
  listeners.forEach((fn) => fn(source));
}

/**
 * Suscribe un consumidor. Recibe la fuente que tomó el turno; si no es la suya,
 * debe detenerse. Devuelve la función para desuscribir.
 */
export function subscribeAudio(fn: (active: AudioSource) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
