/**
 * Repositorio (data-access) de productores en Firestore: `producers/{id}`. Único
 * punto de acceso a estos datos — la UI nunca toca Firestore directo.
 *
 * Documento PÚBLICO en lectura (el home lo muestra sin sesión). La escritura es
 * solo-admin (lo garantizan las reglas). Sin slug ni dueño: id auto-generado.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  type Producer,
  type EditableProducer,
  compararOrden,
} from "@/domain/producer";

const COLLECTION = "producers";

/** Firestore rechaza `undefined`: lo quitamos antes de escribir. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

/** Mapea un documento de Firestore al modelo de dominio. */
function toProducer(id: string, data: DocumentData): Producer {
  return {
    id,
    name: data.name ?? "",
    origin: data.origin ?? "",
    location: (data.location as Producer["location"]) ?? undefined,
    role: data.role ?? "",
    quote: data.quote ?? "",
    bio: data.bio ?? "",
    socials: (data.socials as Producer["socials"]) ?? {},
    mainPhoto: data.mainPhoto ?? "",
    mainPhotoMobile: data.mainPhotoMobile ?? undefined,
    photos: Array.isArray(data.photos)
      ? data.photos.filter((p): p is string => typeof p === "string")
      : [],
    orden: typeof data.orden === "number" ? data.orden : undefined,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
  };
}

/** Todos los productores, ordenados por la curaduría del admin. */
export async function listProducers(): Promise<Producer[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => toProducer(d.id, d.data())).sort(compararOrden);
}

/** Un productor por su id. `null` si no existe. Público en lectura. */
export async function getProducer(id: string): Promise<Producer | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? toProducer(snap.id, snap.data()) : null;
}

/** Crea un productor. Devuelve el id generado. SOLO admin (lo blindan las reglas). */
export async function createProducer(data: EditableProducer): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...stripUndefined(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Actualiza un productor. SOLO admin. */
export async function updateProducer(
  id: string,
  data: Partial<EditableProducer>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

/** Persiste el orden de aparición (curaduría). SOLO admin. */
export async function setOrden(id: string, orden: number): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    orden,
    updatedAt: serverTimestamp(),
  });
}

/** Borra un productor. SOLO admin. Irreversible. */
export async function deleteProducer(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
