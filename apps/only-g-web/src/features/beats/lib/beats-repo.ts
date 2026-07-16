/**
 * Repositorio (data-access) del catálogo de BEATS en Firestore: colección
 * `beats`. Único punto de acceso — la UI nunca toca Firestore directo. Sigue
 * el mismo patrón que `artist-profile-repo` (toBeat mapper, stripUndefined al
 * escribir, serverTimestamp, createdAt?.toMillis()).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Beat, NuevoBeat } from "@only-g/shared-types/beat";

const COLLECTION = "beats";

/** Firestore rechaza `undefined`: lo quitamos antes de escribir. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

/** Mapea un documento de Firestore al modelo de dominio. */
function toBeat(id: string, data: DocumentData): Beat {
  return {
    id,
    beatmakerUid: data.beatmakerUid ?? "",
    beatmakerSlug: data.beatmakerSlug ?? undefined,
    beatmakerNombre: data.beatmakerNombre ?? undefined,
    titulo: data.titulo ?? "",
    genero: data.genero ?? "",
    audioUrl: data.audioUrl ?? "",
    coverUrl: data.coverUrl ?? undefined,
    bpm: typeof data.bpm === "number" ? data.bpm : undefined,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
    activo: data.activo !== false,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
  };
}

/**
 * Catálogo público: beats activos, más recientes primero. Las reglas de
 * Firestore solo permiten leer sin sesión los beats `activo == true`, así que
 * la query ya filtra en el servidor (no se puede confiar en un filtro de
 * cliente). Ordena en memoria (no en la query) para no requerir un índice
 * compuesto por `activo` + `createdAt`.
 */
export async function listBeats(): Promise<Beat[]> {
  const q = query(collection(db, COLLECTION), where("activo", "==", true));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toBeat(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Beats de un beatmaker (incluye inactivos: los ve en "Mis beats"). Ordena en
 * memoria (no en la query) para no requerir un índice compuesto por
 * `beatmakerUid` + `createdAt`.
 */
export async function listBeatsByBeatmaker(uid: string): Promise<Beat[]> {
  const q = query(collection(db, COLLECTION), where("beatmakerUid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toBeat(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Lee un beat por id. Devuelve null si no existe. */
export async function getBeat(id: string): Promise<Beat | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? toBeat(snap.id, snap.data()) : null;
}

/** Publica un beat nuevo. Devuelve el id generado. */
export async function createBeat(nuevo: NuevoBeat): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...stripUndefined(nuevo),
    activo: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Actualiza un beat (contenido y/o su estado activo/inactivo). */
export async function updateBeat(
  id: string,
  patch: Partial<NuevoBeat> & { activo?: boolean },
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), stripUndefined(patch));
}

/** Borra un beat. Solo su dueño o admin (lo garantizan las reglas). */
export async function deleteBeat(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
