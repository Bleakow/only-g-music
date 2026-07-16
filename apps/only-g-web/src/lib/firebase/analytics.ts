/**
 * Analytics de embudo con Firebase Analytics (GA4) — NATIVO, sin vendor externo.
 * `track()` es no-op en SSR y donde Analytics no esté soportado (p. ej. iOS sin
 * PWA), y best-effort (nunca lanza). La inicialización es perezosa: solo se carga
 * Analytics cuando se registra el primer evento en un navegador compatible.
 */
import {
  getAnalytics,
  isSupported,
  logEvent,
  type Analytics,
} from "firebase/analytics";
import type { AnalyticsEvent } from "@only-g/shared-types/analytics";

let analytics: Analytics | null = null;
let init: Promise<Analytics | null> | null = null;

function get(): Promise<Analytics | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (analytics) return Promise.resolve(analytics);
  if (!init) {
    init = isSupported()
      .then((ok) => (ok ? (analytics = getAnalytics()) : null))
      .catch(() => null);
  }
  return init;
}

/** Registra un evento de embudo. No-op en SSR / no soportado. Best-effort. */
export function track(
  event: AnalyticsEvent,
  params?: Record<string, string | number | boolean>,
): void {
  get()
    .then((a) => {
      if (a) logEvent(a, event, params);
    })
    .catch(() => {});
}
