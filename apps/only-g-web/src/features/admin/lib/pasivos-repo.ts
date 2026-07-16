/**
 * Repositorio (data-access) de pasivos: colección `pasivos`. Único punto de
 * acceso — la UI nunca toca Firestore directo. TODO admin-only (lo blindan las
 * reglas). Append-only: liquidar NO borra, marca `saldadoAt`; `createdBy`/
 * `createdAt` son auditoría server-authoritative.
 */
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Pasivo, NuevoPasivo } from "@only-g/shared-types/contabilidad";

const COLLECTION = "pasivos";

/** Firestore rechaza `undefined`: lo quitamos antes de escribir. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

/** Lee un instante que puede venir como Timestamp (auditoría) o número (epoch ms). */
function toMillis(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  const ts = v as { toMillis?: () => number };
  return ts.toMillis?.();
}

/** Mapea un documento de Firestore al modelo de dominio. */
function toPasivo(id: string, data: DocumentData): Pasivo {
  return {
    id,
    nombre: data.nombre ?? "",
    categoria: data.categoria ?? "otro",
    monto: data.monto ?? 0,
    fecha: toMillis(data.fecha) ?? Date.now(),
    acreedor: data.acreedor ?? undefined,
    vencimiento: toMillis(data.vencimiento),
    sede: data.sede ?? undefined,
    nota: data.nota ?? undefined,
    createdBy: data.createdBy ?? "",
    createdAt: toMillis(data.createdAt) ?? Date.now(),
    saldadoAt: toMillis(data.saldadoAt),
    saldadoMotivo: data.saldadoMotivo ?? undefined,
  };
}

/** Todos los pasivos (vigentes y saldados). El filtrado/derivado es puro. */
export async function listPasivos(): Promise<Pasivo[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => toPasivo(d.id, d.data()));
}

/**
 * Registra un pasivo. `createdBy`/`createdAt` los pone el repo (auditoría). El id
 * lo genera Firestore. Devuelve el id creado.
 */
export async function addPasivo(
  nuevo: NuevoPasivo,
  createdBy: string,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...stripUndefined(nuevo),
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Edita los datos de un pasivo (no toca auditoría ni la liquidación). */
export async function updatePasivo(
  id: string,
  patch: Partial<NuevoPasivo>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), stripUndefined(patch));
}

/**
 * Liquida un pasivo (saldado): NO lo borra, marca `saldadoAt`/`saldadoMotivo`. A
 * partir de la liquidación deja de contar en el Balance General.
 */
export async function saldarPasivo(id: string, motivo: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    saldadoAt: serverTimestamp(),
    saldadoMotivo: motivo,
  });
}
