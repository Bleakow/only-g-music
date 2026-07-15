/**
 * Repositorio (data-access) de reservas en Firestore: `bookings/{id}`.
 * La UI nunca toca Firestore directo. La disponibilidad / anti-doble-reserva y
 * las transiciones server-authoritative se construyen en su fase (Track Operativo).
 */
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Reserva, NewReserva, ReservaEstado } from "@/domain/booking";
import type { SedeId } from "@/domain/sede";

const COLLECTION = "bookings";

function toReserva(id: string, data: DocumentData): Reserva {
  return {
    id,
    uid: data.uid,
    serviceSlug: data.serviceSlug,
    serviceName: data.serviceName,
    variantId: data.variantId ?? undefined,
    sede: data.sede,
    start: data.start,
    durationMin: data.durationMin,
    amount: data.amount ?? undefined,
    clientName: data.clientName ?? undefined,
    clientEmail: data.clientEmail ?? undefined,
    quoteId: data.quoteId ?? undefined,
    tipo: data.tipo ?? undefined,
    artistSlug: data.artistSlug ?? undefined,
    comprobanteUrl: data.comprobanteUrl ?? undefined,
    productorId: data.productorId ?? undefined,
    estado: data.estado,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
  };
}

/** Crea una reserva en estado inicial `pendiente_pago`. Omite opcionales vacíos. */
export async function createReserva(data: NewReserva): Promise<string> {
  const payload: Record<string, unknown> = {
    estado: "pendiente_pago",
    createdAt: serverTimestamp(),
  };
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) payload[key] = value;
  }
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

export async function getReservaById(id: string): Promise<Reserva | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? toReserva(snap.id, snap.data()) : null;
}

/** El cliente marca el pago en revisión tras subir el comprobante (pendiente_pago → pago_en_revision). */
export async function marcarPagoEnRevision(
  id: string,
  comprobanteUrl: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    estado: "pago_en_revision",
    comprobanteUrl,
  });
}

// ── Admin (requiere rol admin por reglas) ──────────────────────────
export async function listAllBookings(): Promise<Reserva[]> {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toReserva(d.id, d.data()));
}

export async function updateBookingEstado(
  id: string,
  estado: ReservaEstado,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { estado });
}

/**
 * El admin asigna el productor a la reserva. La creación de la proyección
 * `sessions` la hace una Cloud Function al confirmar (server-authoritative).
 */
export async function setBookingProductor(
  id: string,
  productorId: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { productorId });
}

/** Reservas de un usuario, más recientes primero. Requiere índice (uid + createdAt). */
export async function listReservasByUser(uid: string): Promise<Reserva[]> {
  const q = query(
    collection(db, COLLECTION),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toReserva(d.id, d.data()));
}

// ── Slots tomados (proyección pública para anti-doble-reserva) ──────
// `daySlots/{sedeId}_{mes}` guarda { slots: { "YYYY-MM-DD": { "HH:mm": bookingId } } }.
// Lo leen todos (para pintar disponibilidad) y se actualiza dentro de la
// transacción de reserva (atómico → sin choques entre clientes honestos).

/** Mapa fecha → (hora → bookingId) de los slots ya tomados en una sede+mes. */
export type DaySlots = Record<string, Record<string, string>>;

const daySlotsId = (sedeId: SedeId, mes: string) => `${sedeId}_${mes}`;

export async function getDaySlots(
  sedeId: SedeId,
  mes: string,
): Promise<DaySlots> {
  const snap = await getDoc(doc(db, "daySlots", daySlotsId(sedeId, mes)));
  return snap.exists() ? ((snap.data().slots as DaySlots) ?? {}) : {};
}

/**
 * Crea una reserva ocupando sus slots de forma ATÓMICA. Si algún slot ya está
 * tomado, lanza `SLOT_TAKEN` y no escribe nada (la transacción se aborta).
 */
export async function reservarConSlots(
  data: NewReserva,
  ctx: { mes: string; date: string; slots: string[] },
): Promise<string> {
  const slotsRef = doc(db, "daySlots", daySlotsId(data.sede, ctx.mes));
  const bookingRef = doc(collection(db, COLLECTION));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(slotsRef);
    const all: DaySlots = snap.exists()
      ? ((snap.data().slots as DaySlots) ?? {})
      : {};
    const day = all[ctx.date] ?? {};

    for (const s of ctx.slots) {
      if (day[s]) throw new Error("SLOT_TAKEN");
    }

    const newDay = { ...day };
    for (const s of ctx.slots) newDay[s] = bookingRef.id;
    tx.set(
      slotsRef,
      { slots: { ...all, [ctx.date]: newDay } },
      { merge: true },
    );

    const payload: Record<string, unknown> = {
      estado: "pendiente_pago",
      createdAt: serverTimestamp(),
    };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) payload[key] = value;
    }
    tx.set(bookingRef, payload);
  });

  return bookingRef.id;
}
