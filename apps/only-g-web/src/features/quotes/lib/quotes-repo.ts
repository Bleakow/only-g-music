/**
 * Repositorio (data-access) de solicitudes de cotización en Firestore:
 * `quotes/{id}`. La UI nunca toca Firestore directo.
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
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  QuoteRequest,
  NewQuoteRequest,
  QuoteStatus,
} from "@/domain/quote";

const COLLECTION = "quotes";

function toQuote(id: string, d: DocumentData): QuoteRequest {
  return {
    id,
    uid: d.uid,
    items: d.items ?? [],
    collaborators: d.collaborators ?? undefined,
    details: d.details ?? "",
    references: d.references ?? undefined,
    attachments: d.attachments ?? undefined,
    sede: d.sede,
    budget: d.budget ?? undefined,
    contactName: d.contactName,
    contactEmail: d.contactEmail,
    contactPhone: d.contactPhone ?? undefined,
    estimatedTotal: d.estimatedTotal ?? undefined,
    hasQuoteOnlyItems: d.hasQuoteOnlyItems ?? undefined,
    proposedPrice: typeof d.proposedPrice === "number" ? d.proposedPrice : undefined,
    status: d.status,
    createdAt: d.createdAt?.toMillis?.() ?? Date.now(),
  };
}

/**
 * Crea una solicitud con estado inicial "pendiente". Omite campos opcionales
 * vacíos (Firestore rechaza `undefined`). Devuelve el id del documento.
 */
export async function createQuoteRequest(
  data: NewQuoteRequest,
): Promise<string> {
  const payload: Record<string, unknown> = {
    status: "pendiente",
    createdAt: serverTimestamp(),
  };
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) payload[key] = value;
  }

  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

export async function getQuoteById(id: string): Promise<QuoteRequest | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? toQuote(snap.id, snap.data()) : null;
}

/** Cotizaciones de un usuario, más recientes primero. Requiere índice (uid + createdAt). */
export async function listQuotesByUser(uid: string): Promise<QuoteRequest[]> {
  const q = query(
    collection(db, COLLECTION),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toQuote(d.id, d.data()));
}

// ── Admin (requiere rol admin por reglas) ──────────────────────────
export async function listAllQuotes(): Promise<QuoteRequest[]> {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toQuote(d.id, d.data()));
}

export async function updateQuoteStatus(
  id: string,
  status: QuoteStatus,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { status });
}

/**
 * El estudio envía la propuesta: pasa a `cotizada` y guarda el precio propuesto
 * (server-trusted — la Reserva que genere la aceptación usará este monto). SOLO
 * admin (lo blindan las reglas).
 */
export async function setQuoteProposal(
  id: string,
  price?: number,
): Promise<void> {
  const patch: Record<string, unknown> = { status: "cotizada" };
  if (price != null) patch.proposedPrice = price;
  await updateDoc(doc(db, COLLECTION, id), patch);
}
