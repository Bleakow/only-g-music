import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

/**
 * Instancia de Firebase Messaging SOLO si el entorno la soporta (no en SSR ni en
 * navegadores sin push, p. ej. iOS Safari fuera de PWA). Cacheada. Devuelve null
 * donde no aplica para que el llamador degrade con elegancia.
 */
let cached: Messaging | null = null;

export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (cached) return cached;
  try {
    if (!(await isSupported())) return null;
    cached = getMessaging(); // app por defecto (ya inicializada en ./config)
    return cached;
  } catch {
    return null;
  }
}
