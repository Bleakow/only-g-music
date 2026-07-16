/**
 * Repositorio (data-access) de PETICIONES de beat a medida en Firestore:
 * colección `beatRequests`. Único punto de acceso — la UI nunca toca Firestore
 * directo. Sigue el mismo patrón que `beats-repo` (toBeatRequest mapper,
 * stripUndefined al escribir, serverTimestamp, createdAt?.toMillis()).
 */
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BeatRequest, NuevaBeatRequest } from "@/domain/beat";

const COLLECTION = "beatRequests";

/** Firestore rechaza `undefined`: lo quitamos antes de escribir. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

/** Mapea un documento de Firestore al modelo de dominio. */
function toBeatRequest(id: string, data: DocumentData): BeatRequest {
  return {
    id,
    uid: data.uid ?? "",
    clientName: data.clientName ?? null,
    descripcion: data.descripcion ?? "",
    genero: data.genero ?? undefined,
    ejemploUrl: data.ejemploUrl ?? undefined,
    estado: data.estado ?? "abierta",
    tomadaPor: data.tomadaPor ?? undefined,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
  };
}

/** Crea una petición de beat nueva (estado inicial 'abierta'). Devuelve el id. */
export async function createBeatRequest(
  nueva: NuevaBeatRequest,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...stripUndefined(nueva),
    estado: "abierta",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Peticiones abiertas (para que un beatmaker las tome). Ordena en memoria (no
 * en la query) para no requerir un índice compuesto por `estado` + `createdAt`.
 */
export async function listBeatRequestsAbiertas(): Promise<BeatRequest[]> {
  const q = query(collection(db, COLLECTION), where("estado", "==", "abierta"));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toBeatRequest(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Peticiones del propio cliente ("Mis peticiones"). Ordena en memoria (no en
 * la query) para no requerir un índice compuesto por `uid` + `createdAt`.
 */
export async function listMisPeticiones(uid: string): Promise<BeatRequest[]> {
  const q = query(collection(db, COLLECTION), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toBeatRequest(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Un beatmaker TOMA una petición abierta (abierta → tomada, tomadaPor propio).
 * Las reglas de Firestore validan que quien actualiza tenga rol 'beatmaker' y
 * que la petición siga 'abierta', sin cambiar dueño ni descripción.
 */
export async function tomarBeatRequest(
  id: string,
  beatmakerUid: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    estado: "tomada",
    tomadaPor: beatmakerUid,
  });
}
