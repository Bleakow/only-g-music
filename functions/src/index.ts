/**
 * Cloud Functions de Only G Music (2ª gen). Lógica server-authoritative que el
 * cliente no puede falsear. Desplegar con: `firebase deploy --only functions`.
 *
 * NOTA: estas Functions duplican un par de constantes/formas del dominio web
 * (`PRECIO_PERFIL`, la proyección `Sesion`) porque viven en su propio paquete.
 * Cuando se extraiga `packages/domain` (roadmap), importarlas de ahí.
 */
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

/** Mantener en sync con `src/domain/profile-order.ts`. */
const PRECIO_PERFIL = 80000;

/**
 * Al confirmar una reserva de ESTUDIO con productor asignado, crea la proyección
 * `sessions` (SIN `amount`: el productor no ve cobros — invariante de roles).
 * Idempotente: el id de la sesión = id de la reserva. No aplica a perfiles.
 * Dispara tanto al pasar a `confirmada` como al asignar el productor después.
 */
export const onBookingConfirmed = onDocumentUpdated(
  "bookings/{id}",
  async (event) => {
    const after = event.data?.after.data();
    if (!after) return;

    if (after.estado !== "confirmada") return;
    if (after.tipo === "perfil_artista") return;
    if (!after.productorId) return;

    const reservaId = event.params.id;
    const ref = db.collection("sessions").doc(reservaId);
    if ((await ref.get()).exists) return; // ya existe → idempotente

    await ref.set({
      reservaId,
      productorId: after.productorId,
      uid: after.uid,
      clientName: after.clientName ?? null,
      serviceName: after.serviceName,
      sede: after.sede,
      scheduledStart: after.start,
      scheduledEnd: after.start + (after.durationMin ?? 0) * 60_000,
      estado: "programada",
      createdAt: FieldValue.serverTimestamp(),
    });
    logger.info(
      `Sesión ${reservaId} creada → productor ${after.productorId}`,
    );
  },
);

/**
 * El `amount` de un pedido de perfil lo conoce el servidor (precio fijo). Si el
 * cliente lo creó con otro valor, lo corrige server-side. Para reservas de
 * estudio el precio aún no es validable aquí (los servicios no viven en
 * Firestore todavía): pendiente cuando se migren.
 */
export const onBookingCreatedAmountGuard = onDocumentCreated(
  "bookings/{id}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    if (data.tipo === "perfil_artista" && data.amount !== PRECIO_PERFIL) {
      logger.warn(
        `Monto de perfil corregido en ${event.params.id}: ${data.amount} → ${PRECIO_PERFIL}`,
      );
      await event.data!.ref.update({ amount: PRECIO_PERFIL });
    }
  },
);
