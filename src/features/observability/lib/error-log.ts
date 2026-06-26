/**
 * Logger de errores NATIVO (sin vendor): persiste a `errorLogs` en Firestore para
 * que el admin pueda ver qué se rompió (con stack), más `console.error`. Con
 * dedup por sesión y un tope para no convertir un bug en bucle en una tormenta de
 * escrituras. Nunca lanza — un logger de errores que falla no debe romper más.
 *
 * Sentry queda como upgrade (mejor DX, source maps); este es el mínimo nativo.
 */
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

const enviados = new Set<string>(); // dedup por sesión (clave = contexto+mensaje)
let total = 0;
const MAX_POR_SESION = 25;

export function logError(error: unknown, contexto?: string): void {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? "") : "";
    const clave = `${contexto ?? ""}:${message}`.slice(0, 200);
    if (enviados.has(clave) || total >= MAX_POR_SESION) return;
    enviados.add(clave);
    total += 1;

    console.error("[error-log]", contexto ?? "", error);

    void addDoc(collection(db, "errorLogs"), {
      message: message.slice(0, 1000),
      stack: stack.slice(0, 4000),
      contexto: contexto ?? null,
      url: typeof window !== "undefined" ? window.location.href : null,
      userAgent:
        typeof navigator !== "undefined"
          ? navigator.userAgent.slice(0, 300)
          : null,
      uid: auth.currentUser?.uid ?? null,
      createdAt: serverTimestamp(),
    });
  } catch {
    /* el logger de errores nunca debe lanzar */
  }
}
