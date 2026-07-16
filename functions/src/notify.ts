/**
 * Adaptador del SEAM de notificaciones (lado servidor). Escribe una notificación
 * en `users/{uid}/notifications` — la campanita la lee en tiempo real. El texto
 * NO se guarda resuelto: se guardan `evento` + `params` y el cliente lo traduce
 * al idioma actual (next-intl).
 *
 * Los ids de evento (`NotifEvento`) se importan del dominio compartido
 * `@only-g/shared-types/notification` — única fuente de verdad, ya sin duplicar.
 *
 * Best-effort: si falla la escritura, loguea y sigue — una notificación nunca
 * debe romper la lógica de negocio que la disparó.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";

// Única fuente de verdad en el dominio compartido (ya sin duplicar).
// Se importa para uso local y se re-exporta para consumidores de `./notify`.
import type { NotifEvento } from "@only-g/shared-types/notification";
export type { NotifEvento };

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

  // Push (best-effort): un "nudge" a los dispositivos del usuario. El contenido
  // real y traducido lo muestra la campanita al abrir la app.
  try {
    await enviarPush(uid, ruta);
  } catch (e) {
    logger.error(`[push] ${evento} -> ${uid}`, e);
  }
}

/**
 * Envía un push DATA-only a todos los dispositivos (tokens FCM) del usuario y
 * limpia los tokens muertos. Si no hay tokens, no-op.
 */
async function enviarPush(uid: string, ruta: string): Promise<void> {
  const dbi = getFirestore();
  const snap = await dbi
    .collection("users")
    .doc(uid)
    .collection("fcmTokens")
    .get();
  const tokens = snap.docs.map((d) => d.id);
  if (tokens.length === 0) return;

  const res = await getMessaging().sendEachForMulticast({
    tokens,
    data: {
      title: "Only G",
      body: "Tienes una notificación nueva",
      link: ruta,
    },
  });

  // Borra los tokens que el servicio reporta como inválidos/no registrados.
  const muertos: Promise<unknown>[] = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code ?? "";
    if (
      !r.success &&
      (code.includes("registration-token-not-registered") ||
        code.includes("invalid-argument"))
    ) {
      muertos.push(
        dbi
          .collection("users")
          .doc(uid)
          .collection("fcmTokens")
          .doc(tokens[i])
          .delete(),
      );
    }
  });
  await Promise.all(muertos);
}
