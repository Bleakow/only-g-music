/**
 * Repositorio del libro de TRANSACCIONES (`transactions`): asientos de ingreso
 * que NO son reservas (hoy: pagos de premium confirmados). Solo lectura desde el
 * cliente admin; los asientos los escribe el servidor (Cloud Function
 * confirmPayment) — las reglas impiden la escritura desde el cliente.
 */
import {
  collection,
  getDocs,
  query,
  orderBy,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Transaccion } from "@only-g/shared-types/transaccion";

function toTransaccion(id: string, d: DocumentData): Transaccion {
  return {
    id,
    uid: d.uid,
    clientName: d.clientName ?? null,
    concepto: d.concepto ?? "",
    amount: d.amount ?? 0,
    fecha: d.fecha ?? d.createdAt?.toMillis?.() ?? Date.now(),
    estado: d.estado ?? "confirmada",
    fuente: d.fuente ?? "premium",
  };
}

/** Lee todos los asientos de transacciones (admin), más recientes primero. */
export async function listTransactions(): Promise<Transaccion[]> {
  const snap = await getDocs(
    query(collection(db, "transactions"), orderBy("fecha", "desc")),
  );
  return snap.docs.map((d) => toTransaccion(d.id, d.data()));
}
