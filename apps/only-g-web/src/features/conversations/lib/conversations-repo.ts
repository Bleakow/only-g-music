/**
 * Repositorio de conversaciones (chat generalizado). Los documentos viven en
 * `conversations/{id}` y sus mensajes en la subcolección `messages`. La UI no
 * toca Firestore directo. Las transiciones privilegiadas (confirmar pago,
 * cerrar el hilo, mantener `lastMessage`) son server-authoritative vía Admin SDK
 * / Cloud Functions, que ignoran las reglas de seguridad.
 */
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import type {
  Conversation,
  ConversationMessage,
  NewConversation,
  NewConversationMessage,
  PagoConcepto,
} from "@only-g/shared-types/conversation";
import type { MetodoPago } from "@only-g/shared-types/payment-method";

const COL = "conversations";

/** Quita los campos `undefined` (Firestore los rechaza) y devuelve el payload. */
function stripUndefined(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function toConversation(id: string, d: DocumentData): Conversation {
  return {
    id,
    type: d.type,
    participants: d.participants ?? [],
    status: d.status,
    ref: d.ref ?? undefined,
    pago: d.pago ?? undefined,
    lastMessage: d.lastMessage ?? undefined,
    createdAt: d.createdAt?.toMillis?.() ?? Date.now(),
    updatedAt: d.updatedAt?.toMillis?.() ?? Date.now(),
  };
}

function toMessage(id: string, d: DocumentData): ConversationMessage {
  return {
    id,
    from: d.from,
    tipo: d.tipo,
    texto: d.texto ?? undefined,
    attachmentUrl: d.attachmentUrl ?? undefined,
    attachmentName: d.attachmentName ?? undefined,
    estado: d.estado ?? undefined,
    metodo: d.metodo ?? undefined,
    monto: d.monto ?? undefined,
    price: d.price ?? undefined,
    createdAt: d.createdAt?.toMillis?.() ?? Date.now(),
  };
}

/** Crea una conversación y devuelve su id. */
export async function createConversation(
  data: NewConversation,
): Promise<string> {
  const ref = await addDoc(
    collection(db, COL),
    stripUndefined({
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  return ref.id;
}

/** Lee una conversación puntual (null si no existe). */
export async function getConversation(
  id: string,
): Promise<Conversation | null> {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? toConversation(snap.id, snap.data()) : null;
}

/** Suscripción en vivo a una conversación. Devuelve el unsub. */
export function subscribeConversation(
  id: string,
  cb: (conversation: Conversation | null) => void,
): () => void {
  return onSnapshot(doc(db, COL, id), (snap) =>
    cb(snap.exists() ? toConversation(snap.id, snap.data()) : null),
  );
}

/**
 * Suscripción a las conversaciones de un usuario (las más recientes primero).
 * Requiere índice compuesto: participants (array-contains) + updatedAt (desc).
 */
export function subscribeUserConversations(
  uid: string,
  cb: (conversations: Conversation[]) => void,
): () => void {
  const q = query(
    collection(db, COL),
    where("participants", "array-contains", uid),
    orderBy("updatedAt", "desc"),
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => toConversation(d.id, d.data()))),
  );
}

/** Suscripción a los mensajes de una conversación (orden cronológico). */
export function subscribeMessages(
  conversationId: string,
  cb: (messages: ConversationMessage[]) => void,
): () => void {
  const q = query(
    collection(db, COL, conversationId, "messages"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => toMessage(d.id, d.data()))),
  );
}

/**
 * Publica un mensaje en la conversación (omite campos opcionales vacíos). El
 * `lastMessage`/`updatedAt` del documento padre los mantiene una Cloud Function
 * (trigger onCreate), no el cliente.
 */
export async function sendConversationMessage(
  conversationId: string,
  msg: NewConversationMessage,
): Promise<void> {
  await addDoc(
    collection(db, COL, conversationId, "messages"),
    stripUndefined({ ...msg, createdAt: serverTimestamp() }),
  );
}

// ── Pago (chat de pago: premium, reserva) ───────────────────────────────────

/**
 * Abre un chat de pago para un `concepto` (premium, reserva) con el método ya
 * elegido, enlazado a su entidad de contexto vía `ref`. Estado inicial:
 * `comprobante_pendiente` (falta subir comprobante). El `monto` es informativo:
 * la confirmación server-side es la autoridad.
 */
export async function createPaymentConversation(params: {
  uid: string;
  concepto: PagoConcepto;
  ref: NonNullable<Conversation["ref"]>;
  metodo: MetodoPago;
  monto: number;
}): Promise<string> {
  return createConversation({
    type: "pago",
    participants: [params.uid],
    status: "abierto",
    ref: params.ref,
    pago: {
      concepto: params.concepto,
      monto: params.monto,
      metodo: params.metodo,
      estado: "comprobante_pendiente",
    },
  });
}

/**
 * Transición del cliente al enviar el comprobante: `comprobante_pendiente` →
 * `en_revision` (y el hilo a `esperando_confirmacion`, que bloquea la escritura).
 * Las reglas solo permiten esta transición acotada; confirmar/rechazar es del
 * admin vía Cloud Function.
 */
export async function marcarComprobanteEnRevision(
  conversationId: string,
): Promise<void> {
  await updateDoc(doc(db, COL, conversationId), {
    "pago.estado": "en_revision",
    status: "esperando_confirmacion",
    updatedAt: serverTimestamp(),
  });
}

/** Confirma el pago (solo admin) vía Cloud Function: activa premium + cierra. */
const confirmPaymentFn = httpsCallable<{ conversationId: string }, { ok: boolean }>(
  functions,
  "confirmPayment",
);
export async function confirmarPago(conversationId: string): Promise<void> {
  await confirmPaymentFn({ conversationId });
}

/**
 * Pagos pendientes de revisión por el admin (chats de pago en `en_revision`).
 * Las reglas permiten al admin listar las conversaciones. Requiere índice
 * compuesto: type (==) + updatedAt (desc).
 */
export function subscribePendingPayments(
  cb: (conversations: Conversation[]) => void,
): () => void {
  const q = query(
    collection(db, COL),
    where("type", "==", "pago"),
    orderBy("updatedAt", "desc"),
  );
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs
        .map((d) => toConversation(d.id, d.data()))
        .filter((c) => c.pago?.estado === "en_revision"),
    ),
  );
}

// ── Soporte (chat cliente ↔ estudio de una cotización/reserva) ──────────────

/**
 * Crea (si no existe) la conversación de SOPORTE de una cotización/reserva y
 * devuelve su id determinístico (`{parent}_{id}`), para que cliente y estudio
 * compartan el mismo hilo sobre el modelo `conversations`. Idempotente.
 */
export async function ensureSupportConversation(
  parent: "quotes" | "bookings",
  id: string,
  ownerUid: string,
): Promise<string> {
  const conversationId = `${parent}_${id}`;
  const ref = doc(db, COL, conversationId);
  if (!(await getDoc(ref)).exists()) {
    await setDoc(
      ref,
      stripUndefined({
        type: "soporte",
        participants: [ownerUid],
        status: "abierto",
        ref: { kind: parent === "quotes" ? "quote" : "booking", id },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  }
  return conversationId;
}

// ── Directo (chat usuario ↔ usuario: p. ej. cliente ↔ beatmaker) ────────────

/**
 * Crea (si no existe) el chat DIRECTO entre dos usuarios y devuelve su id
 * determinístico `directo_{uidA}_{uidB}` con los uids ORDENADOS: así abrir el
 * hilo desde cualquiera de los dos —o dos veces— reúsa el MISMO y no duplica.
 * Idempotente. Nace `abierto` con ambos como participantes (el creador debe ser
 * uno de ellos: lo exige la regla de create). NO lleva `ref`: es un hilo por
 * PAR, no por entidad — el contexto (qué beat, etc.) va en el propio mensaje.
 */
export async function ensureDirectConversation(
  uidA: string,
  uidB: string,
): Promise<string> {
  const [a, b] = [uidA, uidB].sort();
  const conversationId = `directo_${a}_${b}`;
  const ref = doc(db, COL, conversationId);
  if (!(await getDoc(ref)).exists()) {
    await setDoc(
      ref,
      stripUndefined({
        type: "directo",
        participants: [uidA, uidB],
        status: "abierto",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  }
  return conversationId;
}
