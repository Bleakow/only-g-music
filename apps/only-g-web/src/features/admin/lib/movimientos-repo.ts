/**
 * Repositorio (data-access) de gastos: colección `movimientos`. Único punto de
 * acceso — la UI nunca toca Firestore directo. TODO admin-only (lo blindan las
 * reglas). Append-only: anular NO borra, marca `anuladoAt`; `createdBy`/
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
import type {
  Movimiento,
  NuevoMovimiento,
  Confirmacion,
  ConfirmacionEstado,
} from "@/domain/contabilidad";

const COLLECTION = "movimientos";

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

/** Normaliza el mapa de confirmaciones (Timestamp → epoch ms; descarta basura). */
function mapConfirmaciones(
  raw: unknown,
): Record<string, Confirmacion> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, Confirmacion> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const o = (v ?? {}) as {
      estado?: unknown;
      montoReal?: unknown;
      confirmadoEn?: unknown;
    };
    if (o.estado !== "pagado" && o.estado !== "no_pagado") continue;
    out[k] = {
      estado: o.estado,
      montoReal: typeof o.montoReal === "number" ? o.montoReal : undefined,
      confirmadoEn: toMillis(o.confirmadoEn) ?? Date.now(),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

/** Mapea un documento de Firestore al modelo de dominio. */
function toMovimiento(id: string, data: DocumentData): Movimiento {
  return {
    id,
    categoria: data.categoria ?? "otro",
    concepto: data.concepto ?? "",
    monto: data.monto ?? 0,
    fecha: toMillis(data.fecha) ?? Date.now(),
    recurrencia: data.recurrencia ?? "unico",
    recurrenciaHasta: toMillis(data.recurrenciaHasta),
    confirmaciones: mapConfirmaciones(data.confirmaciones),
    sede: data.sede ?? undefined,
    comprobanteUrl: data.comprobanteUrl ?? undefined,
    nota: data.nota ?? undefined,
    createdBy: data.createdBy ?? "",
    createdAt: toMillis(data.createdAt) ?? Date.now(),
    anuladoAt: toMillis(data.anuladoAt),
    anuladoMotivo: data.anuladoMotivo ?? undefined,
  };
}

/** Todos los gastos (vigentes y anulados). El filtrado/derivado es puro. */
export async function listMovimientos(): Promise<Movimiento[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => toMovimiento(d.id, d.data()));
}

/**
 * Registra un gasto. `createdBy`/`createdAt` los pone el repo (auditoría). El id
 * lo genera Firestore. Devuelve el id creado.
 */
export async function addMovimiento(
  nuevo: NuevoMovimiento,
  createdBy: string,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...stripUndefined(nuevo),
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Edita los datos de un gasto (no toca auditoría ni la anulación). */
export async function updateMovimiento(
  id: string,
  patch: Partial<NuevoMovimiento>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), stripUndefined(patch));
}

/**
 * Anula un gasto (reversa): NO lo borra, marca `anuladoAt`/`anuladoMotivo`. A
 * partir de la anulación deja de contar en el Estado de Resultados.
 */
export async function anularMovimiento(
  id: string,
  motivo: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    anuladoAt: serverTimestamp(),
    anuladoMotivo: motivo,
  });
}

/**
 * Confirma (o descarta) una ocurrencia recurrente: guarda la respuesta del
 * usuario bajo `confirmaciones.<clave>`. `pagado` la hace contar en el P&L;
 * `no_pagado` la descarta (sin borrar nada: queda registrada la decisión).
 */
export async function confirmarOcurrencia(
  movimientoId: string,
  clave: string,
  estado: ConfirmacionEstado,
  montoReal?: number,
): Promise<void> {
  const patch: Record<string, unknown> = {
    [`confirmaciones.${clave}.estado`]: estado,
    [`confirmaciones.${clave}.confirmadoEn`]: serverTimestamp(),
  };
  if (montoReal != null) {
    patch[`confirmaciones.${clave}.montoReal`] = montoReal;
  }
  await updateDoc(doc(db, COLLECTION, movimientoId), patch);
}
