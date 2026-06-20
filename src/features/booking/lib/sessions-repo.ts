/**
 * Repositorio (data-access) de sesiones en Firestore: `sessions/{id}`.
 * Es la PROYECCIÓN que consume la consola del productor — SIN datos financieros
 * (ver invariante de aislamiento de roles en AGENTS.md). La UI no toca Firestore
 * directo. En 14a el admin la crea client-side al confirmar; en 14b la derivará
 * una Cloud Function.
 */
import {
  collection,
  addDoc,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Sesion, NewSesion, SesionEstado } from "@/domain/booking";

const COLLECTION = "sessions";

/** Firestore rechaza `undefined`: lo quitamos antes de escribir. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

function toSesion(id: string, d: DocumentData): Sesion {
  return {
    id,
    reservaId: d.reservaId,
    productorId: d.productorId,
    uid: d.uid,
    clientName: d.clientName ?? undefined,
    serviceName: d.serviceName,
    sede: d.sede,
    scheduledStart: d.scheduledStart,
    scheduledEnd: d.scheduledEnd,
    startedAt: d.startedAt ?? undefined,
    endedAt: d.endedAt ?? undefined,
    estado: d.estado,
    createdAt: d.createdAt?.toMillis?.() ?? Date.now(),
  };
}

/** Crea la sesión (estado inicial `programada`). Solo admin (por reglas). */
export async function createSesion(data: NewSesion): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...stripUndefined(data),
    estado: "programada",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** ¿Ya existe una sesión para esta reserva? (evita duplicados). */
export async function getSesionByReserva(
  reservaId: string,
): Promise<Sesion | null> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where("reservaId", "==", reservaId)),
  );
  const d = snap.docs[0];
  return d ? toSesion(d.id, d.data()) : null;
}

/**
 * Suscripción en vivo a las sesiones de un productor (ordenadas por hora en
 * memoria, para no exigir índice compuesto). Devuelve el unsub.
 */
export function subscribeSessionsByProductor(
  productorId: string,
  cb: (sesiones: Sesion[]) => void,
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where("productorId", "==", productorId),
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => toSesion(d.id, d.data()))
      .sort((a, b) => a.scheduledStart - b.scheduledStart);
    cb(list);
  });
}

/** El productor marca el inicio real (programada → en_curso). */
export async function startSesion(id: string, startedAt: number): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    estado: "en_curso" as SesionEstado,
    startedAt,
  });
}

/** El productor marca el fin (en_curso → finalizada). */
export async function endSesion(id: string, endedAt: number): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    estado: "finalizada" as SesionEstado,
    endedAt,
  });
}

/** Cancela la sesión (programada → cancelada). */
export async function cancelSesion(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    estado: "cancelada" as SesionEstado,
  });
}
