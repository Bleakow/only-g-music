import type { AiQuotaInfo } from "@only-g/ai-services";

/**
 * Store observable del CUPO de IA freemium. El servidor adjunta `remaining`/
 * `limited` a cada respuesta de IA; aquí se centraliza para que el editor pinte
 * "te quedan N" y el empujón a la membresía al topar, sin acoplar el ghost
 * (CodeMirror) ni el panel a React. Módulo-singleton + suscripción mínima.
 */
export interface QuotaState {
  /** Sugerencias gratis restantes hoy. `null` = sin límite (miembro) o desconocido. */
  remaining: number | null;
  /** true si la última llamada topó el tope diario gratis. */
  limited: boolean;
}

let state: QuotaState = { remaining: null, limited: false };
const listeners = new Set<(s: QuotaState) => void>();

export function getQuota(): QuotaState {
  return state;
}

export function subscribeQuota(cb: (s: QuotaState) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Actualiza el cupo desde una respuesta de IA. Ignora respuestas SIN info de
 * cupo (stub sin API key, o miembro sin límite → `remaining` ausente y no
 * `limited`): esas no deben resetear el contador ni ocultar un aviso previo.
 */
export function reportQuota(res: AiQuotaInfo): void {
  if (res.remaining === undefined && !res.limited) return;
  state = { remaining: res.remaining ?? null, limited: res.limited === true };
  listeners.forEach((cb) => cb(state));
}
