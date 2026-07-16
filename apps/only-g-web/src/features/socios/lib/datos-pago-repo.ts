/**
 * Repositorio (data-access) de los datos de pago del socio: `datosPago/{uid}`
 * (doc dedicado, id = uid). Único punto de acceso — la UI nunca toca Firestore
 * directo. Frontera de seguridad (ver firestore.rules): el DUEÑO escribe sus
 * propios datos; el admin los LEE para poder pagar. Datos SENSIBLES (número de
 * cuenta): nunca se loguean.
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
  DatosPagoSocio,
  NuevoDatosPago,
  DatosBanco,
  DatosNequi,
  DatosEfectivo,
} from "@only-g/shared-types/datos-pago";

const COLLECTION = "datosPago";

/** Firestore rechaza `undefined`: lo quitamos antes de escribir. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

/** Lee un instante que puede venir como Timestamp o número (epoch ms). */
function toMillis(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  const ts = v as { toMillis?: () => number };
  return ts.toMillis?.();
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Mapea el sub-objeto banco (coerción defensiva a strings). */
function mapBanco(raw: unknown): DatosBanco | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const b = raw as Record<string, unknown>;
  return {
    entidad: toStr(b.entidad),
    tipoCuenta: b.tipoCuenta === "corriente" ? "corriente" : "ahorros",
    numeroCuenta: toStr(b.numeroCuenta),
    titular: toStr(b.titular),
    tipoDoc:
      b.tipoDoc === "CE" || b.tipoDoc === "NIT" || b.tipoDoc === "PAS"
        ? b.tipoDoc
        : "CC",
    numeroDoc: toStr(b.numeroDoc),
  };
}

function mapNequi(raw: unknown): DatosNequi | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const n = raw as Record<string, unknown>;
  return { telefono: toStr(n.telefono), titular: toStr(n.titular) };
}

function mapEfectivo(raw: unknown): DatosEfectivo | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const e = raw as Record<string, unknown>;
  const nota = toStr(e.nota);
  return nota ? { nota } : {};
}

/** Mapea un documento de Firestore al modelo de dominio. */
function toDatosPago(data: DocumentData): DatosPagoSocio {
  const metodo =
    data.metodo === "nequi" || data.metodo === "efectivo"
      ? data.metodo
      : "banco";
  return {
    metodo,
    banco: mapBanco(data.banco),
    nequi: mapNequi(data.nequi),
    efectivo: mapEfectivo(data.efectivo),
    updatedAt: toMillis(data.updatedAt) ?? Date.now(),
  };
}

/** Datos de pago de un usuario; `null` si aún no los ha guardado. */
export async function getDatosPago(uid: string): Promise<DatosPagoSocio | null> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  return snap.exists() ? toDatosPago(snap.data()) : null;
}

/**
 * Guarda (o reemplaza) los datos de pago del dueño. `setDoc` SIN merge: reemplaza
 * el doc entero para que al cambiar de método NO queden sub-objetos obsoletos
 * (p. ej. un `banco` viejo tras pasar a `nequi`). `stripUndefined` quita los
 * sub-objetos del método no elegido (Firestore rechaza `undefined`); `updatedAt`
 * lo sella el servidor. Los campos resultantes quedan dentro de la allowlist de
 * las reglas: ['metodo', 'banco', 'nequi', 'efectivo', 'updatedAt'].
 */
export async function updateDatosPago(
  uid: string,
  data: NuevoDatosPago,
): Promise<void> {
  await setDoc(doc(db, COLLECTION, uid), {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}
