/**
 * Repositorio (data-access) de bienes / activos fijos: colección `activos`.
 * Único punto de acceso — la UI nunca toca Firestore directo. TODO admin-only
 * (lo blindan las reglas). Append-only: dar de baja NO borra, marca `bajaAt`;
 * `createdBy`/`createdAt` son auditoría server-authoritative.
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
import type { Activo, NuevoActivo } from "@only-g/shared-types/contabilidad";

const COLLECTION = "activos";

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
function toActivo(id: string, data: DocumentData): Activo {
  return {
    id,
    nombre: data.nombre ?? "",
    categoria: data.categoria ?? "otro",
    valorAdquisicion: data.valorAdquisicion ?? 0,
    fechaAdquisicion: toMillis(data.fechaAdquisicion) ?? Date.now(),
    fotoUrl: data.fotoUrl ?? undefined,
    sede: data.sede ?? undefined,
    vidaUtilMeses:
      typeof data.vidaUtilMeses === "number" ? data.vidaUtilMeses : undefined,
    valorResidual:
      typeof data.valorResidual === "number" ? data.valorResidual : undefined,
    ivaDiferido:
      typeof data.ivaDiferido === "number" ? data.ivaDiferido : undefined,
    nota: data.nota ?? undefined,
    createdBy: data.createdBy ?? "",
    createdAt: toMillis(data.createdAt) ?? Date.now(),
    bajaAt: toMillis(data.bajaAt),
    bajaMotivo: data.bajaMotivo ?? undefined,
  };
}

/** Todos los bienes (vigentes y dados de baja). El filtrado/derivado es puro. */
export async function listActivos(): Promise<Activo[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => toActivo(d.id, d.data()));
}

/**
 * Da de alta un bien. `createdBy`/`createdAt` los pone el repo (auditoría). El
 * id lo genera Firestore. Devuelve el id creado.
 */
export async function addActivo(
  nuevo: NuevoActivo,
  createdBy: string,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...stripUndefined(nuevo),
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Edita los datos de un bien (no toca auditoría ni la baja). */
export async function updateActivo(
  id: string,
  patch: Partial<NuevoActivo>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), stripUndefined(patch));
}

/**
 * Da de baja un bien (venta/descarte): NO lo borra, marca `bajaAt`/`bajaMotivo`.
 * A partir de la baja su valor en libros es 0 y sale de los totales vigentes.
 */
export async function darDeBajaActivo(
  id: string,
  motivo: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    bajaAt: serverTimestamp(),
    bajaMotivo: motivo,
  });
}
