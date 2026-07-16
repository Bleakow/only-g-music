/**
 * Repositorio (data-access) de la disponibilidad del productor en Firestore:
 * `availability/{sedeId}_{mes}`. La UI nunca toca Firestore directo.
 */
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  DisponibilidadMes,
  NewDisponibilidadMes,
} from "@only-g/shared-types/availability";
import type { SedeId } from "@only-g/shared-types/sede";

const COLLECTION = "availability";
const docId = (sedeId: SedeId, mes: string) => `${sedeId}_${mes}`;

function toDisp(id: string, d: DocumentData): DisponibilidadMes {
  return {
    id,
    sedeId: d.sedeId,
    productorId: d.productorId,
    mes: d.mes,
    plantilla: d.plantilla ?? {},
    excepciones: d.excepciones ?? {},
    updatedAt: d.updatedAt?.toMillis?.() ?? Date.now(),
  };
}

/** Disponibilidad de una sede en un mes ("YYYY-MM"). null si no está definida. */
export async function getDisponibilidadMes(
  sedeId: SedeId,
  mes: string,
): Promise<DisponibilidadMes | null> {
  const snap = await getDoc(doc(db, COLLECTION, docId(sedeId, mes)));
  return snap.exists() ? toDisp(snap.id, snap.data()) : null;
}

/** Crea o reemplaza la disponibilidad de un mes (solo productor/admin por reglas). */
export async function saveDisponibilidadMes(
  disp: NewDisponibilidadMes,
): Promise<void> {
  await setDoc(doc(db, COLLECTION, docId(disp.sedeId, disp.mes)), {
    sedeId: disp.sedeId,
    productorId: disp.productorId,
    mes: disp.mes,
    plantilla: disp.plantilla,
    excepciones: disp.excepciones,
    updatedAt: serverTimestamp(),
  });
}
