/**
 * Repositorio del hilo (chat) de una solicitud. Los mensajes viven en una
 * subcolección `messages` bajo `quotes/{id}` o `bookings/{id}`. La UI no toca
 * Firestore directo.
 */
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ThreadMessage, NewThreadMessage } from "@/domain/message";

export type ThreadParent = "quotes" | "bookings";

function toMsg(id: string, d: DocumentData): ThreadMessage {
  return {
    id,
    from: d.from,
    tipo: d.tipo,
    texto: d.texto ?? undefined,
    attachmentUrl: d.attachmentUrl ?? undefined,
    attachmentName: d.attachmentName ?? undefined,
    price: d.price ?? undefined,
    createdAt: d.createdAt?.toMillis?.() ?? Date.now(),
  };
}

/** Suscripción en vivo a los mensajes (orden cronológico). Devuelve el unsub. */
export function subscribeMessages(
  parent: ThreadParent,
  id: string,
  cb: (messages: ThreadMessage[]) => void,
): () => void {
  const q = query(
    collection(db, parent, id, "messages"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => toMsg(d.id, d.data()))),
  );
}

/** Publica un mensaje en el hilo (omite campos opcionales vacíos). */
export async function sendMessage(
  parent: ThreadParent,
  id: string,
  msg: NewThreadMessage,
): Promise<void> {
  const payload: Record<string, unknown> = { createdAt: serverTimestamp() };
  for (const [key, value] of Object.entries(msg)) {
    if (value !== undefined) payload[key] = value;
  }
  await addDoc(collection(db, parent, id, "messages"), payload);
}
