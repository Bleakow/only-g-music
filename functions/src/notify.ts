/**
 * Adaptador del SEAM de notificaciones (lado servidor). Escribe una notificación
 * en `users/{uid}/notifications` — la campanita la lee en tiempo real. El texto
 * NO se guarda resuelto: se guardan `evento` + `params` y el cliente lo traduce
 * al idioma actual (next-intl).
 *
 * Mantener los ids de evento EN SYNC con `src/domain/notification.ts` (catálogo
 * del lado web). Viven duplicados porque `functions/` es su propio paquete; se
 * unificarán cuando se extraiga `packages/domain` (roadmap).
 *
 * Best-effort: si falla la escritura, loguea y sigue — una notificación nunca
 * debe romper la lógica de negocio que la disparó.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

export type NotifEvento =
  | "mensaje-nuevo"
  | "pago-por-revisar"
  | "pago-confirmado"
  | "cotizacion-nueva"
  | "cotizacion-respondida"
  | "sesion-agendada"
  | "sesion-proxima"
  | "gasto-recurrente-por-confirmar"
  | "perfil-artista-creado"
  | "premium-activado"
  | "perfil-por-renovar";

/**
 * Crea una notificación para `uid`. `getFirestore()` se resuelve en runtime (no
 * en carga del módulo) para no correr antes de `initializeApp()`.
 */
export async function notify(
  uid: string | undefined | null,
  evento: NotifEvento,
  params: Record<string, string | number> = {},
  ruta = "/",
): Promise<void> {
  if (!uid) return;
  try {
    await getFirestore()
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .add({
        evento,
        params,
        ruta,
        leido: false,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (e) {
    logger.error(`[notify] ${evento} -> ${uid}`, e);
  }
}
