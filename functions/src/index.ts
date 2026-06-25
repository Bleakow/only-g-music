/**
 * Cloud Functions de Only G Music (2ª gen). Lógica server-authoritative que el
 * cliente no puede falsear. Desplegar con: `firebase deploy --only functions`.
 *
 * NOTA: estas Functions duplican un par de constantes/formas del dominio web
 * (`PRECIO_PERFIL`, la proyección `Sesion`) porque viven en su propio paquete.
 * Cuando se extraiga `packages/domain` (roadmap), importarlas de ahí.
 */
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { notify } from "./notify";

initializeApp();
const db = getFirestore();

/** Región: junto a la base de datos (los triggers de Firestore la exigen). */
const REGION = "southamerica-east1";
/** Mantener en sync con `src/domain/profile-order.ts`. */
const PRECIO_PERFIL = 80000;
/** Meses de vigencia del premium — sync con PREMIUM_DURACION_MESES (dominio). */
const PREMIUM_DURACION_MESES = 2;
/** Horas sin pagar antes de expirar una reserva y liberar su slot. */
const EXPIRY_HORAS = 48;
/** Minutos de gracia antes del auto-inicio (sync con GRACIA_AUTO_INICIO_MIN). */
const GRACIA_MIN = 30;
/** Puntos de gamificación — sync con `PUNTOS` en src/domain/artist-profile.ts. */
const PUNTOS_LIKE = 5;
const PUNTOS_PAGO_PERFIL = 150;

/** Fecha legible (es-CO) para el texto de las notificaciones. */
function fmtFecha(ms: number | undefined): string {
  if (!ms) return "";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

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
    const afterRef = event.data?.after.ref;
    if (!after || !afterRef) return;

    if (after.estado !== "confirmada") return;
    const before = event.data?.before.data();
    const justConfirmed = before?.estado !== "confirmada";

    // Perfil pagado → otorga puntos de gamificación UNA sola vez (flag idempotente).
    if (after.tipo === "perfil_artista") {
      if (after.puntosOtorgados) return;
      await otorgarPuntosPerfil(after.uid, event.params.id, afterRef);
      return;
    }

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

    // Notificaciones (la sesión se acaba de crear → disparan una sola vez).
    await notify(
      after.productorId,
      "sesion-agendada",
      { fecha: fmtFecha(after.start) },
      "/consola",
    );
    if (justConfirmed) {
      await notify(
        after.uid,
        "pago-confirmado",
        { concepto: after.serviceName ?? "tu sesión" },
        `/solicitudes/reserva/${reservaId}`,
      );
    }
  },
);

/**
 * Otorga los puntos por pagar el perfil al artista dueño del booking. Resuelve el
 * perfil vía users/{uid}.artistSlug. Idempotente: marca `puntosOtorgados` en el
 * booking dentro de la transacción para no doble-contar en re-disparos.
 */
async function otorgarPuntosPerfil(
  uid: string,
  bookingId: string,
  bookingRef: FirebaseFirestore.DocumentReference,
): Promise<void> {
  if (!uid) return;
  const userSnap = await db.doc(`users/${uid}`).get();
  const slug = userSnap.data()?.artistSlug as string | undefined;
  if (!slug) return;
  const profileRef = db.doc(`artistProfiles/${slug}`);

  await db.runTransaction(async (tx) => {
    const bk = await tx.get(bookingRef);
    if (bk.data()?.puntosOtorgados) return; // ya otorgados (carrera/re-disparo)
    const prof = await tx.get(profileRef);
    if (!prof.exists) return;
    tx.update(profileRef, {
      puntos: FieldValue.increment(PUNTOS_PAGO_PERFIL),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(bookingRef, { puntosOtorgados: true });
  });
  logger.info(`Puntos de pago de perfil → ${slug} (booking ${bookingId})`);
}

/**
 * Puntos por LIKE (server-authoritative): el cliente nunca escribe `puntos`. Al
 * crear/borrar un doc de like, ajusta los puntos del perfil. Un doc por usuario
 * (las reglas lo garantizan) → no se puede inflar.
 */
export const onLikeAdded = onDocumentCreated(
  "artistProfiles/{slug}/likes/{uid}",
  async (event) => {
    await db.doc(`artistProfiles/${event.params.slug}`).update({
      puntos: FieldValue.increment(PUNTOS_LIKE),
      updatedAt: FieldValue.serverTimestamp(),
    });
  },
);

export const onLikeRemoved = onDocumentDeleted(
  "artistProfiles/{slug}/likes/{uid}",
  async (event) => {
    await db.doc(`artistProfiles/${event.params.slug}`).update({
      puntos: FieldValue.increment(-PUNTOS_LIKE),
      updatedAt: FieldValue.serverTimestamp(),
    });
  },
);

/**
 * Mantiene `lastMessage`/`updatedAt` de la conversación al crear un mensaje
 * (server-authoritative: el cliente solo escribe mensajes en la subcolección,
 * nunca el documento padre). Alimenta la lista de chats sin leer cada hilo.
 */
export const onConversationMessage = onDocumentCreated(
  "conversations/{cid}/messages/{mid}",
  async (event) => {
    const msg = event.data?.data();
    if (!msg) return;
    await db.doc(`conversations/${event.params.cid}`).update({
      lastMessage: {
        tipo: msg.tipo,
        texto: msg.texto ?? null,
        from: msg.from,
        createdAt: msg.createdAt?.toMillis?.() ?? Date.now(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
  },
);

/**
 * Confirma un pago de premium (SOLO admin). Server-authoritative y atómico: en un
 * único batch activa el premium del perfil, cierra/bloquea el chat de pago y
 * postea el mensaje `pago_confirmado`. Idempotente (si ya está confirmado, no
 * hace nada). El monto se toma del precio fijo del servidor, no del cliente.
 */
export const confirmPayment = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Inicia sesión.");

  const roles = (await db.doc(`users/${uid}`).get()).data()?.roles ?? [];
  if (!Array.isArray(roles) || !roles.includes("admin")) {
    throw new HttpsError("permission-denied", "Solo administradores.");
  }

  const conversationId = request.data?.conversationId;
  if (typeof conversationId !== "string" || !conversationId) {
    throw new HttpsError("invalid-argument", "Falta conversationId.");
  }

  const convRef = db.doc(`conversations/${conversationId}`);
  const conv = (await convRef.get()).data();
  if (!conv) throw new HttpsError("not-found", "Conversación inexistente.");
  if (conv.type !== "pago") {
    throw new HttpsError("failed-precondition", "No es un chat de pago.");
  }
  if (conv.pago?.estado === "confirmado") return { ok: true }; // idempotente

  const slug = conv.ref?.id;
  if (conv.ref?.kind !== "premium" || typeof slug !== "string") {
    throw new HttpsError("failed-precondition", "Pago sin perfil asociado.");
  }

  const now = Date.now();
  const expira = new Date(now);
  expira.setMonth(expira.getMonth() + PREMIUM_DURACION_MESES);
  const premium = { activo: true, since: now, expiresAt: expira.getTime() };

  // El pagador del premium es el dueño del perfil (único participante del hilo).
  const payerUid = Array.isArray(conv.participants)
    ? conv.participants[0]
    : undefined;
  const clientName = payerUid
    ? ((await db.doc(`users/${payerUid}`).get()).data()?.displayName ?? null)
    : null;

  const batch = db.batch();
  batch.update(db.doc(`artistProfiles/${slug}`), {
    premium,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.update(convRef, {
    "pago.estado": "confirmado",
    status: "cerrado",
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(convRef.collection("messages").doc(), {
    from: "sistema",
    tipo: "pago_confirmado",
    monto: conv.pago?.monto ?? PRECIO_PERFIL,
    createdAt: FieldValue.serverTimestamp(),
  });
  // Asiento contable del ingreso (lo lee /admin/finanzas vía `transactions`).
  batch.set(db.collection("transactions").doc(), {
    uid: payerUid ?? "",
    clientName,
    concepto: "Premium",
    amount: PRECIO_PERFIL,
    fecha: now,
    estado: "confirmada",
    fuente: "premium",
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  logger.info(`Pago confirmado: ${conversationId} → premium ${slug}`);
  await notify(payerUid, "premium-activado", {}, "/artista/perfil");
  return { ok: true };
});

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

/**
 * Libera los slots ocupados por una reserva en el agregado daySlots. Escanea
 * todas las fechas del doc del mes (robusto ante zona horaria) y borra las horas
 * cuyo valor sea este bookingId. Las reservas de perfil no tienen slots → no-op.
 */
async function liberarSlots(
  bookingId: string,
  sede: string,
  startMs: number,
): Promise<void> {
  if (!sede || !startMs) return;
  const d = new Date(startMs);
  const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const ref = db.doc(`daySlots/${sede}_${mes}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const all = (snap.data()?.slots ?? {}) as Record<
      string,
      Record<string, string>
    >;
    let changed = false;
    for (const fecha of Object.keys(all)) {
      const dia = all[fecha];
      for (const hora of Object.keys(dia)) {
        if (dia[hora] === bookingId) {
          delete dia[hora];
          changed = true;
        }
      }
    }
    if (changed) tx.set(ref, { slots: all }, { merge: true });
  });
}

/**
 * Expira las reservas en `pendiente_pago` con más de EXPIRY_HORAS sin avanzar y
 * libera sus slots. Server-authoritative: corre aunque nadie tenga la app abierta.
 */
export const expireUnpaidBookings = onSchedule(
  { schedule: "every 60 minutes", region: REGION },
  async () => {
    const cutoff = Date.now() - EXPIRY_HORAS * 3_600_000;
    const snap = await db
      .collection("bookings")
      .where("estado", "==", "pendiente_pago")
      .get();
    for (const doc of snap.docs) {
      const b = doc.data();
      const created = b.createdAt?.toMillis?.() ?? 0;
      if (created >= cutoff) continue;
      await doc.ref.update({ estado: "expirada" });
      await liberarSlots(doc.id, b.sede, b.start);
      logger.info(`Reserva ${doc.id} expirada por falta de pago`);
    }
  },
);

/**
 * Auto-inicia las sesiones `programada` cuyo inicio agendado ya pasó la gracia.
 * Versión server-authoritative del auto-inicio de la consola (funciona con la
 * app cerrada). Idempotente: solo toca las que siguen en `programada`.
 */
export const autoStartSessions = onSchedule(
  { schedule: "every 10 minutes", region: REGION },
  async () => {
    const cutoff = Date.now() - GRACIA_MIN * 60_000;
    const snap = await db
      .collection("sessions")
      .where("estado", "==", "programada")
      .get();
    for (const doc of snap.docs) {
      const s = doc.data();
      if ((s.scheduledStart ?? Infinity) > cutoff) continue;
      await doc.ref.update({ estado: "en_curso", startedAt: Date.now() });
      logger.info(`Sesión ${doc.id} auto-iniciada (gracia)`);
    }
  },
);

// ── Admin: gestión de perfiles (vincular a usuario real) ───────────────────────

/** ¿El que llama es admin? Lanza si no hay sesión o no tiene el rol. */
async function assertAdmin(uid: string | undefined): Promise<void> {
  if (!uid) throw new HttpsError("unauthenticated", "Inicia sesión.");
  const roles = (await db.doc(`users/${uid}`).get()).data()?.roles ?? [];
  if (!Array.isArray(roles) || !roles.includes("admin")) {
    throw new HttpsError("permission-denied", "Solo administradores.");
  }
}

/** Slug URL-safe a partir de un nombre. Sync con `toSlug` (src/domain/artist-profile.ts). */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Búsqueda de usuarios para el admin (SOLO admin). El cliente no puede leer otros
 * `users/{uid}` (lo prohíben las reglas), así que la lista para vincular un perfil
 * pasa por aquí. MVP: trae hasta 200 y filtra por email/nombre en memoria; a
 * escala se indexa. Devuelve una proyección mínima (sin datos sensibles).
 */
export const adminSearchUsers = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request.auth?.uid);

  const q = String(request.data?.query ?? "").trim().toLowerCase();
  const snap = await db.collection("users").limit(200).get();
  const users = snap.docs
    .map((d) => {
      const u = d.data();
      return {
        uid: d.id,
        email: (u.email as string | null) ?? null,
        displayName: (u.displayName as string | null) ?? null,
        roles: (u.roles as string[]) ?? [],
        artistSlug: (u.artistSlug as string | null) ?? null,
      };
    })
    .filter(
      (u) =>
        !q ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.displayName?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, 25);

  return { users };
});

/**
 * Crea un perfil de artista VINCULADO a un usuario real y le asigna el rol
 * 'artista' (idempotente: `arrayUnion` no duplica si ya lo tiene). SOLO admin y
 * server-authoritative: el cliente no puede tocar roles/artistSlug de otros. El
 * perfil arranca como BORRADOR (sin premium); el admin lo rellena y activa luego.
 * Si el usuario ya tiene un perfil vinculado, no crea otro.
 */
export const adminLinkProfile = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request.auth?.uid);

  const targetUid = request.data?.targetUid;
  const artisticName =
    typeof request.data?.artisticName === "string"
      ? request.data.artisticName.trim()
      : "";
  if (typeof targetUid !== "string" || !targetUid) {
    throw new HttpsError("invalid-argument", "Falta el usuario a vincular.");
  }
  if (!artisticName) {
    throw new HttpsError("invalid-argument", "Falta el nombre artístico.");
  }

  const userRef = db.doc(`users/${targetUid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "El usuario no existe.");
  }
  const existingSlug = userSnap.data()?.artistSlug;
  if (existingSlug) {
    throw new HttpsError(
      "already-exists",
      `El usuario ya tiene un perfil (${existingSlug}).`,
    );
  }

  // Slug único (server-side).
  const base = slugify(artisticName) || "artista";
  let slug = base;
  let n = 2;
  while ((await db.doc(`artistProfiles/${slug}`).get()).exists) {
    slug = `${base}-${n++}`;
  }

  const batch = db.batch();
  batch.set(db.doc(`artistProfiles/${slug}`), {
    uid: targetUid,
    artisticName,
    tagline: "",
    genre: "",
    bio: "",
    accent: "#8b5cf6",
    photoURL: "",
    gallery: [],
    tracks: [],
    socials: {},
    trajectoryStartYear: new Date().getFullYear(),
    puntos: 0,
    premium: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.update(userRef, {
    artistSlug: slug,
    roles: FieldValue.arrayUnion("artista"),
  });
  await batch.commit();

  logger.info(`Perfil ${slug} vinculado a ${targetUid} (+rol artista)`);
  return { slug };
});
