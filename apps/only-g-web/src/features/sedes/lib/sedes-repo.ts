/**
 * Capa de acceso a sedes. Base = semilla estática + sedes CREADAS por el admin
 * (documento completo en Firestore, `sedes/{id}`) para los ids que no están en
 * la semilla. Sobre la semilla se fusiona además el override editable del admin
 * (ciudad, dirección, horario, destino de pago, productores). Los selectores
 * síncronos siguen usando la semilla directa (sin riesgo); quien necesite el
 * universo completo de sedes (chat de pago, admin) pasa por aquí — async, con
 * fallback a la semilla si Firestore no responde o la regla aún no está
 * desplegada.
 */
import {
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  arrayRemove,
  doc,
  collection,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Sede, SedeId } from "@/domain/sede";
import { sedes } from "../data/sedes";

/** Campos que el admin edita (override guardado en Firestore, sobre la semilla). */
export type SedeOverride = Partial<
  Pick<Sede, "ciudad" | "direccion" | "horario" | "pago" | "productores">
>;

/** Mapea un doc de Firestore (sede CREADA, no semilla) a `Sede`, con defaults. */
function toSede(id: string, data: DocumentData): Sede {
  return {
    id,
    nombre: typeof data.nombre === "string" ? data.nombre : "",
    ciudad: typeof data.ciudad === "string" ? data.ciudad : "",
    direccion: typeof data.direccion === "string" ? data.direccion : "",
    pago: data.pago as Sede["pago"],
    horario: typeof data.horario === "string" ? data.horario : "",
    slots: Array.isArray(data.slots) ? (data.slots as string[]) : [],
    productores: Array.isArray(data.productores)
      ? (data.productores as string[])
      : [],
  };
}

export async function getAllSedes(): Promise<Sede[]> {
  try {
    const snap = await getDocs(collection(db, "sedes"));
    const seedIds = new Set(sedes.map((s) => s.id));
    const docs = new Map(snap.docs.map((d) => [d.id, d.data()]));
    const base = sedes.map((s) => ({ ...s, ...(docs.get(s.id) ?? {}) }));
    const nuevas = snap.docs
      .filter((d) => !seedIds.has(d.id))
      .map((d) => toSede(d.id, d.data()));
    return [...base, ...nuevas];
  } catch {
    return sedes;
  }
}

export async function getSedeById(id: SedeId): Promise<Sede | null> {
  const base = sedes.find((s) => s.id === id);
  try {
    const snap = await getDoc(doc(db, "sedes", id));
    if (base) {
      return snap.exists()
        ? { ...base, ...(snap.data() as SedeOverride) }
        : base;
    }
    return snap.exists() ? toSede(id, snap.data()) : null;
  } catch {
    return base ?? null;
  }
}

/** Guarda (merge) el override editable de una sede (SOLO admin). */
export async function setSedeOverride(
  id: SedeId,
  data: SedeOverride,
): Promise<void> {
  await setDoc(doc(db, "sedes", id), data, { merge: true });
}

/**
 * Crea una sede nueva (SOLO admin). `sede.id` ya viene resuelto (slug del
 * nombre) por quien llama. Falla si el id choca con una sede de la semilla o
 * con una sede creada existente — evita pisar datos por una colisión de slug.
 */
export async function createSede(sede: Sede): Promise<void> {
  const seedIds = new Set(sedes.map((s) => s.id));
  if (seedIds.has(sede.id)) {
    throw new Error(`Ya existe una sede con el id "${sede.id}".`);
  }
  const existing = await getDoc(doc(db, "sedes", sede.id));
  if (existing.exists()) {
    throw new Error(`Ya existe una sede con el id "${sede.id}".`);
  }
  const { id, ...data } = sede;
  await setDoc(doc(db, "sedes", id), data);
}

/**
 * Quita un productor de la sede (SOLO admin). NO revoca el rol `productor` (el
 * usuario podría estar asignado a otra sede); la asignación de rol es server-side.
 */
export async function removeProductorFromSede(
  id: SedeId,
  uid: string,
): Promise<void> {
  await updateDoc(doc(db, "sedes", id), { productores: arrayRemove(uid) });
}
