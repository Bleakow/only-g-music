/**
 * Repositorio (data-access) de PEDIDOS en Firestore: `pedidos/{id}`. Un pedido es
 * una compra directa de uno o varios servicios de precio fijo con UN pago.
 *
 * `createPedido` crea el pedido Y sus N reservas (una por línea) de forma ATÓMICA
 * en una sola transacción: bloquea los slots de las líneas de SESIÓN (anti-doble-
 * reserva, misma proyección `daySlots` que las reservas sueltas) y crea las de
 * ENTREGABLE sin slot. Si algún slot está tomado, aborta sin escribir nada.
 *
 * La UI nunca toca Firestore directo. El pago se maneja en un chat único sobre el
 * pedido; al confirmar el comprobante (admin), una Cloud Function confirma todas
 * las reservas del pedido a la vez.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  type Pedido,
  type PedidoLinea,
  type PedidoEstado,
  type LineaTipo,
  cantidadSana,
} from "@only-g/shared-types/pedido";
import type { PricingModel } from "@only-g/shared-types/service";
import type { SedeId } from "@only-g/shared-types/sede";
import type { PersonasTier } from "@only-g/shared-types/precios-servicios";
import type { QuoteCollaborator } from "@only-g/shared-types/quote";
import type { DaySlots } from "@/features/booking/lib/booking-repo";

const PEDIDOS = "pedidos";
const BOOKINGS = "bookings";
const daySlotsId = (sede: SedeId, mes: string) => `${sede}_${mes}`;

/** Línea de entrada para crear un pedido (lo que arma el carrito). */
export interface PedidoLineaInput {
  serviceSlug: string;
  serviceName: string;
  variantId?: string;
  tipo: LineaTipo;
  pricing: PricingModel;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  // Agenda (solo `sesion`):
  start?: number;
  durationMin?: number;
  /** Contexto para bloquear el slot (solo `sesion`): mes "YYYY-MM", fecha
   *  "YYYY-MM-DD" y las horas "HH:mm" a ocupar. */
  slotCtx?: { mes: string; date: string; slots: string[] };
}

export interface CreatePedidoInput {
  uid: string;
  sede: SedeId;
  clientName?: string;
  clientEmail?: string;
  lineas: PedidoLineaInput[];
  total: number;
  personas?: PersonasTier;
  details?: string;
  referenceUrl?: string;
  collaborators?: QuoteCollaborator[];
}

function toPedido(id: string, data: DocumentData): Pedido {
  return {
    id,
    uid: data.uid,
    sede: data.sede,
    lineas: (data.lineas as PedidoLinea[]) ?? [],
    total: data.total ?? 0,
    personas: data.personas ?? undefined,
    details: data.details ?? undefined,
    referenceUrl: data.referenceUrl ?? undefined,
    collaborators: (data.collaborators as QuoteCollaborator[]) ?? undefined,
    clientName: data.clientName ?? undefined,
    clientEmail: data.clientEmail ?? undefined,
    paymentConversationId: data.paymentConversationId ?? undefined,
    comprobanteUrl: data.comprobanteUrl ?? undefined,
    estado: data.estado,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
  };
}

/**
 * Crea un pedido y sus reservas de forma atómica. Las líneas de sesión ocupan sus
 * slots; si alguno está tomado (por otra reserva o por otra línea del mismo
 * carrito) lanza `SLOT_TAKEN` y no escribe nada. Devuelve el id del pedido.
 */
export async function createPedido(input: CreatePedidoInput): Promise<string> {
  const pedidoRef = doc(collection(db, PEDIDOS));
  const reservaRefs = input.lineas.map(() => doc(collection(db, BOOKINGS)));

  // Documentos daySlots distintos que hay que leer (una sede por pedido; puede
  // haber varias sesiones en meses distintos).
  const slotDocIds = [
    ...new Set(
      input.lineas
        .filter((l) => l.tipo === "sesion" && l.slotCtx)
        .map((l) => daySlotsId(input.sede, l.slotCtx!.mes)),
    ),
  ];

  await runTransaction(db, async (tx) => {
    // 1) LECTURAS primero (obligatorio en transacciones): estado actual de slots.
    const slotMap = new Map<string, DaySlots>();
    for (const id of slotDocIds) {
      const snap = await tx.get(doc(db, "daySlots", id));
      slotMap.set(
        id,
        snap.exists() ? ((snap.data().slots as DaySlots) ?? {}) : {},
      );
    }

    // 2) Asignación incremental de slots (detecta choques con lo ya tomado y
    //    entre líneas del mismo pedido).
    input.lineas.forEach((l, i) => {
      if (l.tipo !== "sesion" || !l.slotCtx) return;
      const all = slotMap.get(daySlotsId(input.sede, l.slotCtx.mes))!;
      const day = { ...(all[l.slotCtx.date] ?? {}) };
      for (const s of l.slotCtx.slots) {
        if (day[s]) throw new Error("SLOT_TAKEN");
        day[s] = reservaRefs[i].id;
      }
      all[l.slotCtx.date] = day;
    });

    // 3) ESCRITURAS: slots, reservas y el pedido.
    for (const id of slotDocIds) {
      tx.set(doc(db, "daySlots", id), { slots: slotMap.get(id) }, { merge: true });
    }

    input.lineas.forEach((l, i) => {
      const cantidad = cantidadSana(l.cantidad);
      const nombre =
        l.tipo === "entregable" && cantidad > 1
          ? `${l.serviceName} ×${cantidad}`
          : l.serviceName;
      const payload: Record<string, unknown> = {
        uid: input.uid,
        serviceSlug: l.serviceSlug,
        serviceName: nombre,
        sede: input.sede,
        start: l.start ?? 0,
        durationMin: l.durationMin ?? 0,
        amount: l.subtotal,
        tipo: l.tipo,
        pedidoId: pedidoRef.id,
        estado: "pendiente_pago",
        createdAt: serverTimestamp(),
      };
      if (l.variantId) payload.variantId = l.variantId;
      if (input.clientName) payload.clientName = input.clientName;
      if (input.clientEmail) payload.clientEmail = input.clientEmail;
      tx.set(reservaRefs[i], payload);
    });

    const lineas: PedidoLinea[] = input.lineas.map((l, i) => {
      const linea: PedidoLinea = {
        serviceSlug: l.serviceSlug,
        serviceName: l.serviceName,
        tipo: l.tipo,
        pricing: l.pricing,
        cantidad: cantidadSana(l.cantidad),
        precioUnitario: l.precioUnitario,
        subtotal: l.subtotal,
        reservaId: reservaRefs[i].id,
      };
      if (l.variantId) linea.variantId = l.variantId;
      if (l.start != null) linea.start = l.start;
      if (l.durationMin != null) linea.durationMin = l.durationMin;
      return linea;
    });

    const pedidoPayload: Record<string, unknown> = {
      uid: input.uid,
      sede: input.sede,
      lineas,
      total: input.total,
      estado: "pendiente_pago",
      createdAt: serverTimestamp(),
    };
    if (input.clientName) pedidoPayload.clientName = input.clientName;
    if (input.clientEmail) pedidoPayload.clientEmail = input.clientEmail;
    if (input.personas) pedidoPayload.personas = input.personas;
    if (input.details?.trim()) pedidoPayload.details = input.details.trim();
    if (input.referenceUrl?.trim())
      pedidoPayload.referenceUrl = input.referenceUrl.trim();
    if (input.collaborators && input.collaborators.length > 0)
      pedidoPayload.collaborators = input.collaborators;
    tx.set(pedidoRef, pedidoPayload);
  });

  return pedidoRef.id;
}

export async function getPedidoById(id: string): Promise<Pedido | null> {
  const snap = await getDoc(doc(db, PEDIDOS, id));
  return snap.exists() ? toPedido(snap.id, snap.data()) : null;
}

/** Pedidos de un usuario, recientes primero. Requiere índice (uid + createdAt). */
export async function listPedidosByUser(uid: string): Promise<Pedido[]> {
  const q = query(
    collection(db, PEDIDOS),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toPedido(d.id, d.data()));
}

/** El cliente marca el pago del pedido en revisión tras subir el comprobante. */
export async function marcarPedidoPagoEnRevision(
  id: string,
  comprobanteUrl: string,
): Promise<void> {
  await updateDoc(doc(db, PEDIDOS, id), {
    estado: "pago_en_revision" satisfies PedidoEstado,
    comprobanteUrl,
  });
}

/** Vincula la conversación de pago creada para el pedido. */
export async function setPedidoPaymentConversation(
  id: string,
  paymentConversationId: string,
): Promise<void> {
  await updateDoc(doc(db, PEDIDOS, id), { paymentConversationId });
}
