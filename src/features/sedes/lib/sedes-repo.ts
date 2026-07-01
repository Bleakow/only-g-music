/**
 * Capa de acceso a sedes. Base = semilla estática; encima se fusiona el override
 * editable del admin en Firestore (`sedes/{id}`: ciudad, dirección, horario,
 * destino de pago, productores). Los selectores síncronos siguen usando la
 * semilla directa (sin riesgo); quien necesite el override (chat de pago, admin)
 * pasa por aquí — async, con fallback a la semilla si Firestore no responde o la
 * regla aún no está desplegada.
 */
import {
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  arrayRemove,
  doc,
  collection,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Sede, SedeId } from "@/domain/sede";
import { sedes } from "../data/sedes";

/** Campos que el admin edita (override guardado en Firestore, sobre la semilla). */
export type SedeOverride = Partial<
  Pick<Sede, "ciudad" | "direccion" | "horario" | "pago" | "productores">
>;

export async function getAllSedes(): Promise<Sede[]> {
  try {
    const snap = await getDocs(collection(db, "sedes"));
    const ov = new Map<string, SedeOverride>();
    snap.forEach((d) => ov.set(d.id, d.data() as SedeOverride));
    return sedes.map((s) => ({ ...s, ...(ov.get(s.id) ?? {}) }));
  } catch {
    return sedes;
  }
}

export async function getSedeById(id: SedeId): Promise<Sede | null> {
  const base = sedes.find((s) => s.id === id);
  if (!base) return null;
  try {
    const snap = await getDoc(doc(db, "sedes", id));
    return snap.exists() ? { ...base, ...(snap.data() as SedeOverride) } : base;
  } catch {
    return base;
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
 * Quita un productor de la sede (SOLO admin). NO revoca el rol `productor` (el
 * usuario podría estar asignado a otra sede); la asignación de rol es server-side.
 */
export async function removeProductorFromSede(
  id: SedeId,
  uid: string,
): Promise<void> {
  await updateDoc(doc(db, "sedes", id), { productores: arrayRemove(uid) });
}
