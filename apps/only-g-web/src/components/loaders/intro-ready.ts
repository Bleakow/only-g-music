// Señal simple (pub/sub a nivel de módulo) para coordinar las animaciones de
// entrada del Hero con el FIN del InitialLoader. Si las entradas arrancan
// mientras el overlay del vinilo tapa la pantalla (mín. 2s), no se ven; esto
// las dispara justo cuando el loader se va.
//
// El estado vive a nivel de módulo: en una recarga completa se reinicia
// (`done=false`, espera al loader); en navegación cliente (donde el loader ya no
// se muestra) `done` ya es true y `onIntroReady` dispara de inmediato.

let done = false;
const listeners = new Set<() => void>();

/** Lo llama el InitialLoader cuando empieza a desvanecerse. Idempotente. */
export function markIntroReady(): void {
  if (done) return;
  done = true;
  for (const l of listeners) l();
  listeners.clear();
}

/**
 * Ejecuta `cb` cuando el loader inicial termina — o de inmediato si ya terminó
 * (p. ej. navegación cliente sin loader). Devuelve un unsubscribe.
 */
export function onIntroReady(cb: () => void): () => void {
  if (done) {
    cb();
    return () => {};
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
