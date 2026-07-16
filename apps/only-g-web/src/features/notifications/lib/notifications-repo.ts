/**
 * Repositorio (data-access) de notificaciones del usuario:
 * `users/{uid}/notifications/{id}`. Único punto de acceso — la UI nunca toca
 * Firestore directo. Las CREA el servidor (Admin SDK / Cloud Functions, vía el
 * seam `notify`); el cliente solo LEE en tiempo real y marca leído/archivado
 * (lo blindan las reglas).
 */
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Notificacion, NotifPayload } from "@only-g/shared-types/notification";

const SUB = "notifications";
/** Tope de la campanita: las últimas N. El archivado/TTL lo maneja el servidor. */
const MAX = 50;

function toNotificacion(id: string, data: DocumentData): Notificacion {
  return {
    id,
    evento: data.evento,
    params: (data.params ?? {}) as NotifPayload,
    ruta: data.ruta ?? "/",
    leido: data.leido === true,
    archivado: data.archivado === true,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
  };
}

/**
 * Suscripción en tiempo real a las notificaciones del usuario (más recientes
 * primero). Devuelve la función para desuscribirse. En error (reglas/offline)
 * entrega una lista vacía y lo loguea — la campanita no rompe la app.
 */
export function subscribeNotificaciones(
  uid: string,
  cb: (items: Notificacion[]) => void,
): () => void {
  const q = query(
    collection(db, "users", uid, SUB),
    orderBy("createdAt", "desc"),
    limit(MAX),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toNotificacion(d.id, d.data()))),
    (e) => {
      console.error("[notif] subscribe:", e);
      cb([]);
    },
  );
}

/** Marca una notificación como leída. */
export async function marcarLeido(uid: string, id: string): Promise<void> {
  await updateDoc(doc(db, "users", uid, SUB, id), { leido: true });
}

/** Marca varias como leídas en una sola escritura atómica (batch). */
export async function marcarTodoLeido(
  uid: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(doc(db, "users", uid, SUB, id), { leido: true });
  }
  await batch.commit();
}

/** Archiva una notificación (sale de la campanita; no se borra). */
export async function archivar(uid: string, id: string): Promise<void> {
  await updateDoc(doc(db, "users", uid, SUB, id), { archivado: true });
}
