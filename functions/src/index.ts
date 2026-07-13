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
import { getStorage } from "firebase-admin/storage";
import { notify, type NotifEvento } from "./notify";
import { notifyAdminWhatsApp, deepLink } from "./whatsapp";

initializeApp();
const db = getFirestore();

/** Región: junto a la base de datos (los triggers de Firestore la exigen). */
const REGION = "southamerica-east1";
/** Mantener en sync con `src/domain/profile-order.ts`. */
const PRECIO_PERFIL = 80000;
/** Meses de vigencia del premium — sync con PREMIUM_DURACION_MESES (dominio). */
const PREMIUM_DURACION_MESES = 2;
/** Precio de la MEMBRESÍA mensual (toggle admin) en COP — sync con dominio. */
const PRECIO_MEMBRESIA = 15000;
/** Meses de vigencia de la membresía del toggle admin (distinta del perfil, 2m). */
const MEMBRESIA_DURACION_MESES = 1;
/** Precio de catálogo de un BEAT en COP — sync con PRECIO_BEAT (src/domain/beat.ts). */
const PRECIO_BEAT = 40000;
/** Comisión FIJA de la plataforma por venta de beat — sync con COMISION_BEAT (dominio). */
const COMISION_BEAT = 0.2;
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

/** COP legible para el texto de las notificaciones. */
function fmtCOP(amount: number | undefined): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

/** UIDs con rol admin (destinatarios de los avisos internos). */
async function adminUids(): Promise<string[]> {
  const snap = await db
    .collection("users")
    .where("roles", "array-contains", "admin")
    .get();
  return snap.docs.map((d) => d.id);
}

/**
 * Texto (es-CO) del aviso de WhatsApp para los eventos internos de admin. Vive aquí
 * (lado servidor) porque CallMeBot necesita el texto YA resuelto — a diferencia de
 * la notificación in-app, que guarda evento+params y traduce el cliente.
 */
function textoWhatsAppAdmin(
  evento: NotifEvento,
  params: Record<string, string | number>,
): string {
  switch (evento) {
    case "cotizacion-nueva":
      return `🟣 *Nueva cotización* de ${params.cliente ?? "un cliente"}.`;
    case "pago-por-revisar":
      return `💸 *Pago por revisar*: ${params.cliente ?? "un cliente"} — ${params.monto ?? ""}.`;
    case "perfil-artista-creado":
      return `🎤 *Nuevo perfil de artista*: ${params.nombre ?? ""}.`;
    case "gasto-recurrente-por-confirmar":
      return `📅 *Gasto recurrente por confirmar*: ${params.concepto ?? ""}.`;
    case "convenio-solicitado":
      return `🤝 *Nueva solicitud de convenio* (${params.tipo ?? ""}) de ${params.nombre ?? "un usuario"}.`;
    default:
      return "🔔 Nuevo evento en Only G.";
  }
}

/**
 * Notifica el mismo evento a todos los admin. Canales: in-app + push (por admin) y,
 * además, un WhatsApp al número del negocio (un solo destinatario opt-in, ver
 * ./whatsapp). El WhatsApp es best-effort y no-op si no está configurado.
 */
async function notifyAdmins(
  evento: NotifEvento,
  params: Record<string, string | number>,
  ruta: string,
): Promise<void> {
  const uids = await adminUids();
  await Promise.all(uids.map((uid) => notify(uid, evento, params, ruta)));
  await notifyAdminWhatsApp(
    textoWhatsAppAdmin(evento, params) + deepLink(ruta),
  );
}

/** ¿El uid tiene rol admin? (para elegir el deep link admin vs cliente). */
async function isAdminUid(uid: string): Promise<boolean> {
  const roles = (await db.doc(`users/${uid}`).get()).data()?.roles ?? [];
  return Array.isArray(roles) && roles.includes("admin");
}

/** Segmento de ruta de detalle según el tipo de la conversación. */
function tipoSegment(kind?: string): string | null {
  if (kind === "quote") return "cotizacion";
  if (kind === "booking") return "reserva";
  return null;
}

/** Suma meses a un epoch ms recortando el día al último del mes destino. */
function sumarMesesMs(baseMs: number, meses: number): number {
  const base = new Date(baseMs);
  const total = base.getMonth() + meses;
  const anio = base.getFullYear() + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimoDia = new Date(anio, mes + 1, 0).getDate();
  return new Date(anio, mes, Math.min(base.getDate(), ultimoDia)).getTime();
}

/** Clave de periodo de una ocurrencia ("YYYY-MM" mensual, "YYYY" anual). */
function claveOcurrencia(ms: number, recurrencia: string): string {
  const d = new Date(ms);
  if (recurrencia === "anual") return `${d.getFullYear()}`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

    // Pago confirmado de una reserva (estudio/proyecto, no perfil) → avisa al
    // cliente. Va aquí (no en la rama de sesión) para cubrir también los proyectos,
    // que no tienen productor ni slot.
    if (justConfirmed && after.tipo !== "perfil_artista") {
      await notify(
        after.uid,
        "pago-confirmado",
        { concepto: after.serviceName ?? "tu reserva" },
        `/solicitudes/reserva/${event.params.id}`,
      );
    }

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
    logger.info(`Sesión ${reservaId} creada → productor ${after.productorId}`);

    // Notificaciones (la sesión se acaba de crear → disparan una sola vez).
    await notify(
      after.productorId,
      "sesion-agendada",
      { fecha: fmtFecha(after.start) },
      "/consola",
    );
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

    // Notifica a los demás participantes (solo mensajes de contenido real;
    // los de sistema/estado no avisan). El deep link va al detalle según el rol.
    if (!["mensaje", "comprobante", "propuesta"].includes(msg.tipo)) return;
    const from = msg.from;
    if (!from || from === "sistema") return;
    const conv = (
      await db.doc(`conversations/${event.params.cid}`).get()
    ).data();
    if (!conv) return;
    const recipients: string[] = (conv.participants ?? []).filter(
      (p: string) => p && p !== from,
    );
    if (recipients.length === 0) return;
    const u = (await db.doc(`users/${from}`).get()).data();
    const actor = u?.displayName ?? u?.email ?? "—";
    const seg = tipoSegment(conv.ref?.kind);
    for (const r of recipients) {
      const base = (await isAdminUid(r)) ? "/admin" : "/solicitudes";
      const ruta = seg && conv.ref?.id ? `${base}/${seg}/${conv.ref.id}` : base;
      await notify(r, "mensaje-nuevo", { actor }, ruta);
    }
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

  const refKind = conv.ref?.kind;
  const refId = conv.ref?.id;
  if (typeof refId !== "string") {
    throw new HttpsError("failed-precondition", "Pago sin contexto asociado.");
  }

  // Pago de RESERVA: transiciona la reserva (dispara la sesión) y cierra el hilo.
  if (refKind === "booking") {
    return await confirmarPagoReserva(convRef, conv, refId);
  }
  // Pago de BEAT: entrega el máster, registra la venta y cierra el hilo.
  if (refKind === "beat") {
    return await confirmarPagoBeat(convRef, conv, refId);
  }
  if (refKind !== "premium") {
    throw new HttpsError("failed-precondition", "Tipo de pago no soportado.");
  }
  const slug = refId;

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
 * Confirma el pago de una RESERVA (SOLO admin, vía confirmPayment). Transiciona
 * la reserva a `confirmada` — eso dispara onBookingConfirmed (crea la sesión y
 * notifica al cliente) — y cierra/bloquea el chat de pago. NO escribe en
 * `transactions`: el ingreso de reservas lo DERIVA /admin/finanzas de las
 * reservas confirmadas (escribirlo aquí lo contaría dos veces).
 */
async function confirmarPagoReserva(
  convRef: ReturnType<typeof db.doc>,
  conv: FirebaseFirestore.DocumentData,
  bookingId: string,
): Promise<{ ok: true }> {
  const bookingRef = db.doc(`bookings/${bookingId}`);
  const booking = (await bookingRef.get()).data();
  if (!booking) throw new HttpsError("not-found", "Reserva inexistente.");
  if (
    booking.estado !== "pago_en_revision" &&
    booking.estado !== "pendiente_pago"
  ) {
    throw new HttpsError(
      "failed-precondition",
      "La reserva no está lista para confirmar.",
    );
  }

  const batch = db.batch();
  batch.update(bookingRef, {
    estado: "confirmada",
    confirmedAt: FieldValue.serverTimestamp(),
  });
  batch.update(convRef, {
    "pago.estado": "confirmado",
    status: "cerrado",
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(convRef.collection("messages").doc(), {
    from: "sistema",
    tipo: "pago_confirmado",
    monto: conv.pago?.monto ?? booking.amount ?? 0,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  logger.info(
    `Pago de reserva confirmado: ${convRef.id} → booking ${bookingId}`,
  );
  // La notificación al cliente ("pago-confirmado") la dispara onBookingConfirmed.
  return { ok: true };
}

/**
 * Config comercial server-authoritative: precio/comisión de beat leídos de
 * `comercialConfig/actual` (colección server-only — ver firestore.rules) con
 * FALLBACK a las constantes del dominio. NO hace falta sembrar el doc: si no
 * existe (o el campo no es número), rige la constante. Así el negocio puede
 * ajustar la comisión sin desplegar, sin exponerla al cliente (a diferencia de
 * `config/{doc}`, legible por cualquier autenticado).
 */
async function getComercial(): Promise<{
  precioBeat: number;
  comisionBeat: number;
}> {
  const c = (await db.doc("comercialConfig/actual").get()).data() ?? {};
  // Validación de DOMINIO (última línea de defensa server-side; el futuro panel
  // CEO escribirá aquí): el precio debe ser un ENTERO > 0 y la comisión estar en
  // [0,1]. Un config malformado NO puede producir un neto negativo (comisión>1)
  // ni montos fraccionarios. Fuera de rango → se ignora y rige la constante.
  const precioBeat =
    typeof c.precioBeat === "number" && c.precioBeat > 0
      ? Math.round(c.precioBeat)
      : PRECIO_BEAT;
  const comisionBeat =
    typeof c.comisionBeat === "number" &&
    c.comisionBeat >= 0 &&
    c.comisionBeat <= 1
      ? c.comisionBeat
      : COMISION_BEAT;
  return { precioBeat, comisionBeat };
}

/**
 * Confirma el pago de un BEAT (SOLO admin, vía confirmPayment). Server-authoritative
 * y atómico: cierra el chat de pago (o lo deja abierto para entrega manual),
 * intenta entregar el máster (URL FIRMADA de 7 días) y registra: la venta en
 * `beatSales`, el asiento de la COMISIÓN en `transactions` (único INGRESO de
 * Only G — el neto NO lo es) y la DEUDA del `neto` al beatmaker en `payouts`
 * (cuenta por pagar por persona, ahora VISIBLE en el Balance). El neto se
 * transfiere aparte, manual, y se marca vía `marcarBeatPayout`
 * (`beatSales.paidOut`, que la Fase 3 migrará a `payouts.estado`).
 *
 * Seguridad (IDOR): `masterPath` SOLO se firma si empieza por
 * `beats/masters/{beatmakerUid}/`, la carpeta privada del PROPIO beatmaker del
 * beat. `firestore.rules` ya lo constriñe al guardar, pero esta función no
 * confía ciegamente en datos históricos: si apunta a otra carpeta, se trata
 * como entrega manual y se loggea (evita firmar/exfiltrar el máster de otro
 * beatmaker).
 *
 * Resiliencia: `getSignedUrl` NUNCA debe abortar el pago — va en try/catch y,
 * si falla, la entrega cae a manual. El batch (abrir/cerrar el hilo,
 * `beatSales`, el asiento de comisión y los avisos) se ejecuta SIEMPRE.
 * NOTA PRODUCCIÓN: `getSignedUrl` V4 requiere que la Service Account de
 * runtime de esta Function (2ª gen) tenga el rol
 * `roles/iam.serviceAccountTokenCreator` sobre sí misma; sin ese rol la firma
 * falla y la entrega cae a manual (no rompe la venta).
 *
 * Idempotencia: `beatSales`, `transactions` y `payouts` usan un id DETERMINISTA
 * keyed por `conversationId` (como `activarMembresia`), así dos confirmaciones
 * concurrentes/retry del MISMO chat sobrescriben en vez de duplicar (evita
 * doble comisión + doble payout/deuda).
 */
async function confirmarPagoBeat(
  convRef: ReturnType<typeof db.doc>,
  conv: FirebaseFirestore.DocumentData,
  beatId: string,
): Promise<{ ok: true }> {
  const beatSnap = await db.doc(`beats/${beatId}`).get();
  const beat = beatSnap.data();
  if (!beat) throw new HttpsError("not-found", "Beat inexistente.");

  const conversationId = convRef.id;
  const buyerUid = Array.isArray(conv.participants)
    ? (conv.participants[0] as string | undefined)
    : undefined;
  const buyerNombre = buyerUid
    ? ((await db.doc(`users/${buyerUid}`).get()).data()?.displayName ?? null)
    : null;
  const beatmakerUid = (beat.beatmakerUid as string | undefined) ?? "";
  const beatmakerNombre = (beat.beatmakerNombre as string | undefined) ?? null;
  const beatTitulo = (beat.titulo as string | undefined) ?? "";

  // Config-driven: precio/comisión de `comercialConfig/actual` con fallback a las
  // constantes. El histórico no muta (precio/comision/neto quedan congelados en
  // beatSales/payouts con el valor vigente AL confirmar).
  const { precioBeat, comisionBeat } = await getComercial();
  const precio = precioBeat;
  const comision = Math.round(precio * comisionBeat);
  const neto = precio - comision;

  // Entrega: URL firmada del máster (7 días), SOLO si `masterPath` pertenece a
  // la carpeta privada del PROPIO beatmaker del beat (defensa IDOR — ver JSDoc).
  const masterPath = beat.masterPath as string | undefined;
  const masterOk =
    typeof masterPath === "string" &&
    masterPath.startsWith(`beats/masters/${beatmakerUid}/`);
  if (masterPath && !masterOk) {
    logger.warn(
      `beat ${beatId}: masterPath fuera de la carpeta del beatmaker (${beatmakerUid}) — entrega manual: ${masterPath}`,
    );
  }

  let signedUrl: string | null = null;
  if (masterOk && masterPath) {
    try {
      const [url] = await getStorage()
        .bucket()
        .file(masterPath)
        .getSignedUrl({
          action: "read",
          expires: Date.now() + 7 * 24 * 3600 * 1000,
        });
      signedUrl = url;
    } catch (e) {
      logger.error("beat master signUrl:", e);
      signedUrl = null;
    }
  }
  const texto = signedUrl
    ? "Pago confirmado. Descarga tu beat aquí (el enlace expira en 7 días)."
    : "Pago confirmado. El beatmaker te entregará el archivo por este chat.";

  const batch = db.batch();
  batch.update(convRef, {
    "pago.estado": "confirmado",
    // Con máster entregado, el hilo se cierra. Sin él, queda abierto (y se
    // suma al beatmaker como participante) para que la entrega por chat sea
    // una promesa cumplible, no un callejón sin salida.
    status: signedUrl ? "cerrado" : "abierto",
    // Suma al beatmaker como participante SOLO si existe (un beat malformado sin
    // beatmakerUid no debe meter '' en participants).
    ...(signedUrl || !beatmakerUid
      ? {}
      : { participants: FieldValue.arrayUnion(beatmakerUid) }),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(convRef.collection("messages").doc(), {
    from: "sistema",
    tipo: "pago_confirmado",
    texto,
    ...(signedUrl ? { attachmentUrl: signedUrl } : {}),
    createdAt: FieldValue.serverTimestamp(),
  });
  // Ids DETERMINISTAS (keyed por conversationId): un retry/confirmación
  // concurrente del MISMO chat sobrescribe en vez de duplicar la venta.
  batch.set(db.doc(`beatSales/${conversationId}`), {
    beatId,
    beatTitulo,
    beatmakerUid,
    beatmakerNombre,
    buyerUid: buyerUid ?? "",
    buyerNombre,
    precio,
    comision,
    neto,
    paidOut: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  // Asiento contable de la COMISIÓN (el neto del beatmaker no es ingreso de Only
  // G; se paga aparte y se marca en `beatSales.paidOut`, sin asiento).
  batch.set(db.doc(`transactions/beat_${conversationId}`), {
    uid: buyerUid ?? "",
    clientName: buyerNombre,
    concepto: "Comisión beat",
    amount: comision,
    fecha: Date.now(),
    estado: "confirmada",
    fuente: "beat",
    createdAt: FieldValue.serverTimestamp(),
  });
  // PASIVO por persona: el NETO adeudado al beatmaker, ahora VISIBLE como payout
  // pendiente (lo suma el Balance General). Id DETERMINISTA `beat_{conversationId}`
  // (mismo patrón que beatSales/transactions) → idempotente: un retry/confirmación
  // concurrente del MISMO chat sobrescribe en vez de duplicar la deuda. MISMO batch
  // (atómico con beatSales+transactions). `beatSales.paidOut` NO cambia su
  // semántica (compat Fase 3, que migrará la liquidación a estos payouts).
  // Solo si el beat tiene beatmaker: un beat malformado (sin beatmakerUid) NO
  // debe generar un payout a acreedorUid='' (deuda "a nadie" que inflaría el
  // Balance y nadie podría leer/liquidar). La venta y el asiento igual se registran.
  if (beatmakerUid) {
    batch.set(db.doc(`payouts/beat_${conversationId}`), {
      acreedorUid: beatmakerUid,
      acreedorNombre: beatmakerNombre,
      origen: "beat",
      refId: beatId,
      monto: neto,
      estado: "pendiente",
      createdAt: FieldValue.serverTimestamp(),
    });
  } else {
    logger.warn(
      `beat ${beatId}: venta ${conversationId} sin beatmakerUid — no se crea payout.`,
    );
  }
  await batch.commit();

  logger.info(`Pago de beat confirmado: ${conversationId} → beat ${beatId}`);
  await notify(buyerUid, "pago-confirmado", { concepto: beatTitulo }, "/beats");
  // El beatmaker SIEMPRE se entera de la venta, entregue el servidor el
  // máster o le toque entregarlo manualmente por el chat.
  await notify(
    beatmakerUid,
    "beat-vendido",
    { titulo: beatTitulo },
    "/beats/publicar",
  );
  return { ok: true };
}

/**
 * Marca el payout de una venta de beat como pagado (SOLO admin): la transferencia
 * del `neto` al beatmaker es MANUAL (fuera de la app, como el resto de pagos);
 * esto solo deja constancia. Server-authoritative: `beatSales` no admite
 * escritura desde el cliente (regla `write: false`), así que el toggle pasa por
 * esta Cloud Function callable, no por un `updateDoc` directo.
 */
export const marcarBeatPayout = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request.auth?.uid);
  const saleId = request.data?.saleId;
  if (typeof saleId !== "string" || !saleId) {
    throw new HttpsError("invalid-argument", "Falta la venta.");
  }
  const saleRef = db.doc(`beatSales/${saleId}`);
  if (!(await saleRef.get()).exists) {
    throw new HttpsError("not-found", "Venta inexistente.");
  }
  const now = Date.now();
  const batch = db.batch();
  batch.update(saleRef, { paidOut: true, paidOutAt: now });
  // Mantén SINCRONIZADO el payout equivalente (mismo id determinista
  // `beat_{saleId}`, con saleId === conversationId): si existe, márcalo pagado
  // para que el Balance deje de contarlo como pendiente. Sin esto, pagar por el
  // botón viejo dejaría el payout en 'pendiente' y el balance SOBREESTIMARÍA la
  // deuda. Puede no existir si la venta es pre-Fase 2 y aún no se hizo backfill:
  // en ese caso no hay nada que sincronizar (el balance tampoco lo cuenta).
  const payoutRef = db.doc(`payouts/beat_${saleId}`);
  if ((await payoutRef.get()).exists) {
    batch.update(payoutRef, { estado: "pagado", pagadoAt: now });
  }
  await batch.commit();
  logger.info(`Payout de beat marcado como pagado: ${saleId}`);
  return { ok: true };
});

/**
 * Backfill (SOLO admin): genera los `payouts` faltantes desde las `beatSales`
 * históricas aún NO pagadas (`paidOut == false`) — las que se vendieron antes de
 * la Fase 2, cuando el neto solo vivía en `beatSales`. Server-authoritative.
 *
 * Idempotente y NO destructivo: solo CREA los payouts FALTANTES (salta las ventas
 * que ya tienen payout), así nunca pisa ni "resucita a pendiente" uno ya liquidado
 * —incluso si una fase futura desincroniza `beatSales.paidOut` de `payouts.estado`—.
 * Salta también ventas sin `beatmakerUid` (no crea deuda a ''). NO borra ni toca
 * `beatSales`. Escribe en tandas (< 500) por el límite de un batch. Devuelve cuántos
 * creó.
 */
export const backfillPayouts = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request.auth?.uid);
  const [salesSnap, payoutsSnap] = await Promise.all([
    db.collection("beatSales").where("paidOut", "==", false).get(),
    db.collection("payouts").get(),
  ]);
  const yaExiste = new Set(payoutsSnap.docs.map((d) => d.id));
  // Solo ventas NO pagadas, CON beatmaker, y SIN payout previo: nunca sobrescribimos
  // un payout existente (evita resucitar uno liquidado) ni creamos deuda a ''.
  const docs = salesSnap.docs.filter((d) => {
    const s = d.data();
    return (
      typeof s.beatmakerUid === "string" &&
      s.beatmakerUid !== "" &&
      !yaExiste.has(`beat_${d.id}`)
    );
  });

  let count = 0;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + 400)) {
      const s = doc.data();
      batch.set(db.doc(`payouts/beat_${doc.id}`), {
        acreedorUid: s.beatmakerUid as string,
        acreedorNombre: (s.beatmakerNombre as string | undefined) ?? null,
        origen: "beat",
        refId: (s.beatId as string | undefined) ?? "",
        monto: typeof s.neto === "number" ? s.neto : 0,
        estado: "pendiente",
        // Conserva la fecha ORIGINAL de la venta (mejor para el libro) si existe.
        createdAt: s.createdAt ?? FieldValue.serverTimestamp(),
      });
      count++;
    }
    await batch.commit();
  }

  logger.info(`Backfill de payouts: ${count} payout(s) creados`);
  return { count };
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

  const q = String(request.data?.query ?? "")
    .trim()
    .toLowerCase();
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

  // Deriva disciplines/socio de los roles FINALES (los actuales + 'artista'),
  // para que un socio (beatmaker/productor) nazca visible sin membresía y en su
  // pestaña — en vez de forzar socio:false y dejarlo fuera de la vitrina.
  const currentRoles = Array.isArray(userSnap.data()?.roles)
    ? (userSnap.data()?.roles as string[])
    : [];
  const finalRoles = [...new Set([...currentRoles, "artista"])];
  const TALENT = ["artista", "beatmaker", "modelo", "bailarin"];
  const disciplines = finalRoles.filter((r) => TALENT.includes(r));
  const socio =
    finalRoles.includes("beatmaker") || finalRoles.includes("productor");

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
    disciplines: disciplines.length ? disciplines : ["artista"],
    socio,
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

/**
 * Asigna el rol `productor` a un usuario y lo registra en una sede (SOLO admin,
 * server-authoritative; el cliente no puede tocar roles). Idempotente
 * (`arrayUnion`). El rol da acceso a la consola; la sede lo lista como productor.
 */
export const adminAssignProductor = onCall(
  { region: REGION },
  async (request) => {
    await assertAdmin(request.auth?.uid);

    const targetUid = request.data?.targetUid;
    const sedeId = request.data?.sedeId;
    if (typeof targetUid !== "string" || !targetUid) {
      throw new HttpsError("invalid-argument", "Falta el usuario.");
    }
    if (typeof sedeId !== "string" || !sedeId) {
      throw new HttpsError("invalid-argument", "Falta la sede.");
    }

    const userRef = db.doc(`users/${targetUid}`);
    if (!(await userRef.get()).exists) {
      throw new HttpsError("not-found", "El usuario no existe.");
    }

    const batch = db.batch();
    batch.update(userRef, { roles: FieldValue.arrayUnion("productor") });
    batch.set(
      db.doc(`sedes/${sedeId}`),
      { productores: FieldValue.arrayUnion(targetUid) },
      { merge: true },
    );
    await batch.commit();

    logger.info(`Productor ${targetUid} asignado a sede ${sedeId}`);
    return { ok: true };
  },
);

/**
 * Proyección de usuarios por sus UIDs (SOLO admin). El cliente no puede leer
 * otros `users/{uid}`; sirve para mostrar por nombre a los productores ya
 * asignados a una sede. Devuelve solo los que existen (tope 50).
 */
export const adminGetUsersByIds = onCall(
  { region: REGION },
  async (request) => {
    await assertAdmin(request.auth?.uid);

    const uids = Array.isArray(request.data?.uids)
      ? (request.data.uids as unknown[]).filter(
          (u): u is string => typeof u === "string",
        )
      : [];
    if (uids.length === 0) return { users: [] };

    const snaps = await Promise.all(
      uids.slice(0, 50).map((uid) => db.doc(`users/${uid}`).get()),
    );
    const users = snaps
      .filter((s) => s.exists)
      .map((s) => {
        const u = s.data() ?? {};
        return {
          uid: s.id,
          email: (u.email as string | null) ?? null,
          displayName: (u.displayName as string | null) ?? null,
          roles: (u.roles as string[]) ?? [],
          artistSlug: (u.artistSlug as string | null) ?? null,
        };
      });
    return { users };
  },
);

/**
 * Activa la MEMBRESÍA mensual de un perfil (SOLO admin, toggle desde el panel).
 * Server-authoritative y atómica: en un único batch activa `premium` con la
 * vigencia de la membresía (1 mes). Si `cortesia` es true, la regala el admin
 * sin generar asiento contable; si no, registra el ingreso en `transactions`
 * (igual que el pago del perfil, pero con concepto/fuente "Membresia").
 */
export const activarMembresia = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request.auth?.uid);
  const slug = request.data?.slug;
  const cortesia = request.data?.cortesia === true;
  if (typeof slug !== "string" || !slug) {
    throw new HttpsError("invalid-argument", "Falta el perfil.");
  }
  const profRef = db.doc(`artistProfiles/${slug}`);
  const profSnap = await profRef.get();
  if (!profSnap.exists) {
    throw new HttpsError("not-found", "Perfil inexistente.");
  }
  const prof = profSnap.data();
  const now = Date.now();
  const expira = new Date(now);
  expira.setMonth(expira.getMonth() + MEMBRESIA_DURACION_MESES);
  // Spread condicional: no emitir cortesia:undefined (Firestore lo rechaza anidado).
  const premium = {
    activo: true,
    since: now,
    expiresAt: expira.getTime(),
    ...(cortesia ? { cortesia: true } : {}),
  };
  const payerUid = prof?.uid as string | undefined;
  const clientName = payerUid
    ? ((await db.doc(`users/${payerUid}`).get()).data()?.displayName ?? null)
    : null;
  const batch = db.batch();
  batch.update(profRef, { premium, updatedAt: FieldValue.serverTimestamp() });
  // Solo el PAGO genera asiento contable; la cortesía no. Id DETERMINISTA
  // `membresia_{slug}_{YYYY-MM}`: reactivar o reintentar el MISMO mes sobrescribe
  // el asiento en vez de duplicar el ingreso (idempotencia por periodo).
  if (!cortesia) {
    const periodo = new Date(now);
    const periodKey = `${periodo.getUTCFullYear()}-${String(
      periodo.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    batch.set(db.doc(`transactions/membresia_${slug}_${periodKey}`), {
      uid: payerUid ?? "",
      clientName,
      concepto: "Membresia",
      amount: PRECIO_MEMBRESIA,
      fecha: now,
      estado: "confirmada",
      fuente: "membresia",
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  logger.info(
    `Membresia activada: ${slug} (${cortesia ? "cortesia" : "pago"})`,
  );
  if (payerUid)
    await notify(payerUid, "premium-activado", {}, "/artista/perfil");
  return { ok: true };
});

/**
 * Fija los roles de un usuario (SOLO admin, server-authoritative: las reglas
 * de `users` prohíben tocar `roles` desde el cliente). Sincroniza además el
 * perfil vinculado (si existe): `disciplines` refleja los roles de talento y
 * `socio` (beatmaker/productor) exime de la membresía (ver `perfilVisible`,
 * dominio). Guard anti-lockout: un admin no puede quitarse su propio rol admin.
 */
export const adminSetRoles = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request.auth?.uid);
  const targetUid = request.data?.uid;
  const rawRoles = request.data?.roles;
  if (typeof targetUid !== "string" || !targetUid) {
    throw new HttpsError("invalid-argument", "Falta el usuario.");
  }
  if (!Array.isArray(rawRoles)) {
    throw new HttpsError("invalid-argument", "Roles invalidos.");
  }
  const VALID = [
    "cliente",
    "productor",
    "admin",
    "artista",
    "beatmaker",
    "modelo",
    "bailarin",
  ];
  const roles = [
    ...new Set(
      rawRoles.filter((r) => typeof r === "string" && VALID.includes(r)),
    ),
  ];
  if (roles.length === 0) roles.push("cliente"); // nunca dejar una cuenta sin rol
  // Guard anti-lockout: el admin no puede quitarse su propio rol admin.
  if (targetUid === request.auth?.uid && !roles.includes("admin")) {
    throw new HttpsError(
      "failed-precondition",
      "No puedes quitarte tu propio rol admin.",
    );
  }
  const userRef = db.doc(`users/${targetUid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Usuario inexistente.");
  }
  const user = userSnap.data();
  const batch = db.batch();
  batch.update(userRef, { roles });
  // Sincroniza el perfil vinculado (si existe): disciplines = roles de talento; socio = beatmaker/productor.
  const slug = user?.artistSlug as string | undefined;
  if (typeof slug === "string" && slug) {
    // Solo sincroniza si el perfil EXISTE. Un artistSlug colgante (perfil
    // borrado, u onboarding sin perfil creado aún) haría fallar el batch entero
    // por NOT_FOUND y bloquearía el propio cambio de roles.
    const profRef = db.doc(`artistProfiles/${slug}`);
    const profSnap = await profRef.get();
    // Verifica PROPIEDAD del perfil (confused deputy): el cliente puede fijar su
    // propio users.artistSlug apuntando al perfil de OTRA persona; sin este check,
    // sincronizar aquí pisaría el perfil de una víctima.
    if (profSnap.exists && profSnap.data()?.uid === targetUid) {
      const TALENT = ["artista", "beatmaker", "modelo", "bailarin"];
      const disciplines = roles.filter((r) => TALENT.includes(r));
      const socio = roles.includes("beatmaker") || roles.includes("productor");
      batch.update(profRef, {
        disciplines: disciplines.length ? disciplines : ["artista"],
        socio,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
  await batch.commit();
  logger.info(`Roles de ${targetUid} = [${roles.join(",")}]`);
  return { ok: true, roles };
});

// ── Admin: solicitudes de convenio (productor/beatmaker) ───────────────────────

/**
 * Aprueba una solicitud de convenio (SOLO admin, server-authoritative: las
 * reglas de `convenioRequests` prohíben `update` desde el cliente). Otorga el
 * rol correspondiente —`productor` exige `sedeId` y registra en la sede,
 * `beatmaker` no— y sincroniza el perfil vinculado (si existe) con la MISMA
 * lógica que `adminSetRoles`, para que el nuevo socio quede visible sin
 * membresía en cuanto se aprueba.
 */
export const aprobarConvenio = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request.auth?.uid);
  const requestId = request.data?.requestId;
  const sedeId = request.data?.sedeId;
  if (typeof requestId !== "string" || !requestId) {
    throw new HttpsError("invalid-argument", "Falta la solicitud.");
  }

  const reqRef = db.doc(`convenioRequests/${requestId}`);
  const reqSnap = await reqRef.get();
  const req = reqSnap.data();
  if (!req) {
    throw new HttpsError("not-found", "La solicitud no existe.");
  }
  if (req.estado !== "pendiente") {
    throw new HttpsError(
      "failed-precondition",
      "La solicitud ya fue resuelta.",
    );
  }
  const targetUid = req.uid as string;
  const tipo = req.tipo as string;

  const userRef = db.doc(`users/${targetUid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "El usuario no existe.");
  }

  const batch = db.batch();
  if (tipo === "productor") {
    if (typeof sedeId !== "string" || !sedeId) {
      throw new HttpsError("invalid-argument", "Falta la sede.");
    }
    batch.update(userRef, { roles: FieldValue.arrayUnion("productor") });
    batch.set(
      db.doc(`sedes/${sedeId}`),
      { productores: FieldValue.arrayUnion(targetUid) },
      { merge: true },
    );
  } else if (tipo === "beatmaker") {
    batch.update(userRef, { roles: FieldValue.arrayUnion("beatmaker") });
  } else {
    throw new HttpsError("failed-precondition", "Tipo de convenio inválido.");
  }
  batch.update(reqRef, { estado: "aprobada", resueltoAt: Date.now() });

  // Sincroniza el perfil vinculado (si existe), igual que adminSetRoles:
  // disciplines = roles de talento FINALES (actuales + el nuevo); socio =
  // incluye beatmaker/productor. Se lee el user ANTES del commit para poder
  // encadenar esta actualización en el MISMO batch (atómico).
  const slug = userSnap.data()?.artistSlug as string | undefined;
  if (typeof slug === "string" && slug) {
    const profRef = db.doc(`artistProfiles/${slug}`);
    const profSnap = await profRef.get();
    // Verifica PROPIEDAD del perfil: sin este check, un artistSlug que apunte al
    // perfil de OTRA persona (el cliente puede escribir su propio users.artistSlug
    // libremente) haría que la aprobación pisara el perfil de una VÍCTIMA
    // (confused deputy). Solo se sincroniza si el perfil es del mismo usuario.
    if (profSnap.exists && profSnap.data()?.uid === targetUid) {
      const currentRoles = Array.isArray(userSnap.data()?.roles)
        ? (userSnap.data()?.roles as string[])
        : [];
      const finalRoles = [...new Set([...currentRoles, tipo])];
      const TALENT = ["artista", "beatmaker", "modelo", "bailarin"];
      const disciplines = finalRoles.filter((r) => TALENT.includes(r));
      const socio =
        finalRoles.includes("beatmaker") || finalRoles.includes("productor");
      batch.update(profRef, {
        disciplines: disciplines.length ? disciplines : ["artista"],
        socio,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await batch.commit();
  logger.info(`Convenio ${requestId} aprobado: ${targetUid} (+rol ${tipo})`);
  await notify(targetUid, "convenio-aprobado", { tipo }, "/artista/perfil");
  return { ok: true };
});

/**
 * Rechaza una solicitud de convenio (SOLO admin). No otorga ningún rol; solo
 * marca la solicitud y avisa al solicitante.
 */
export const rechazarConvenio = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request.auth?.uid);
  const requestId = request.data?.requestId;
  if (typeof requestId !== "string" || !requestId) {
    throw new HttpsError("invalid-argument", "Falta la solicitud.");
  }
  const motivo =
    typeof request.data?.motivo === "string" ? request.data.motivo : "";

  const reqRef = db.doc(`convenioRequests/${requestId}`);
  const reqSnap = await reqRef.get();
  const req = reqSnap.data();
  if (!req) {
    throw new HttpsError("not-found", "La solicitud no existe.");
  }
  if (req.estado !== "pendiente") {
    throw new HttpsError(
      "failed-precondition",
      "La solicitud ya fue resuelta.",
    );
  }

  await reqRef.update({
    estado: "rechazada",
    motivo,
    resueltoAt: Date.now(),
  });
  logger.info(`Convenio ${requestId} rechazado`);
  await notify(req.uid, "convenio-rechazado", { motivo }, "/solicitudes");
  return { ok: true };
});

// ── Notificaciones dirigidas por eventos (seam `notify`) ───────────────────────

/** Nueva solicitud de cotización → avisa a los admin. */
export const onQuoteCreated = onDocumentCreated(
  "quotes/{id}",
  async (event) => {
    const q = event.data?.data();
    if (!q) return;
    await notifyAdmins(
      "cotizacion-nueva",
      { cliente: q.contactName ?? "Un cliente" },
      `/admin/cotizacion/${event.params.id}`,
    );
  },
);

/** El estudio respondió (pendiente → cotizada) → avisa al cliente dueño. */
export const onQuoteAnswered = onDocumentUpdated(
  "quotes/{id}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after) return;
    if (before?.status !== "cotizada" && after.status === "cotizada") {
      await notify(
        after.uid,
        "cotizacion-respondida",
        {},
        `/solicitudes/cotizacion/${event.params.id}`,
      );
    }
  },
);

/** El cliente subió comprobante (pago en revisión) → avisa a los admin. */
export const onPaymentUnderReview = onDocumentUpdated(
  "conversations/{id}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after) return;
    if (
      before?.pago?.estado !== "en_revision" &&
      after.pago?.estado === "en_revision"
    ) {
      // Reserva: refleja el comprobante en el estado de la reserva (server-side).
      if (after.ref?.kind === "booking" && typeof after.ref?.id === "string") {
        const bRef = db.doc(`bookings/${after.ref.id}`);
        const b = (await bRef.get()).data();
        if (b?.estado === "pendiente_pago") {
          await bRef.update({ estado: "pago_en_revision" });
        }
      }
      const payerUid = Array.isArray(after.participants)
        ? after.participants[0]
        : undefined;
      const clientName = payerUid
        ? ((await db.doc(`users/${payerUid}`).get()).data()?.displayName ??
          "Un cliente")
        : "Un cliente";
      await notifyAdmins(
        "pago-por-revisar",
        { cliente: clientName, monto: fmtCOP(after.pago?.monto) },
        "/admin/pagos",
      );
    }
  },
);

/** Nuevo perfil de artista creado → avisa a los admin. */
/**
 * Deriva `disciplines`/`socio` de un conjunto de roles. `disciplines` = roles de
 * talento (default `['artista']` si no hay ninguno); `socio` = beatmaker/productor
 * (exentos de membresía). Mismo criterio que `adminLinkProfile`/`adminSetRoles`;
 * extraído para el alta self-serve (los 3 sitios previos podrían adoptarlo luego).
 */
function deriveDisciplinesSocio(roles: unknown): {
  disciplines: string[];
  socio: boolean;
} {
  const TALENT = ["artista", "beatmaker", "modelo", "bailarin"];
  const finalRoles = Array.isArray(roles) ? (roles as string[]) : [];
  const disciplines = finalRoles.filter((r) => TALENT.includes(r));
  return {
    disciplines: disciplines.length ? disciplines : ["artista"],
    socio: finalRoles.includes("beatmaker") || finalRoles.includes("productor"),
  };
}

export const onArtistProfileCreated = onDocumentCreated(
  "artistProfiles/{slug}",
  async (event) => {
    const p = event.data?.data();
    if (!p) return;

    // Deriva disciplines/socio de los roles del DUEÑO y los escribe en el perfil:
    // el cliente NO puede setearlos (las reglas los bloquean en create y update,
    // son server-authoritative), así que un perfil AUTOGESTIONADO (p. ej. de un
    // beatmaker) nacería con socio:false y quedaría invisible
    // (perfilVisible = socio || premium) hasta esta derivación. `adminLinkProfile`
    // ya los pone al crear; aquí cubrimos el alta SELF-SERVE. El uid del perfil
    // está fijado a su dueño por la regla de create (uid == auth.uid), así que
    // derivar de SUS roles es seguro (no hay confused-deputy). Solo escribe si
    // difiere de lo ya guardado (evita una escritura redundante en el path admin).
    const ownerUid = typeof p.uid === "string" ? p.uid : null;
    if (ownerUid) {
      const roles = (await db.doc(`users/${ownerUid}`).get()).data()?.roles;
      const derived = deriveDisciplinesSocio(roles);
      const currentDisc = Array.isArray(p.disciplines)
        ? (p.disciplines as string[])
        : [];
      const sameDisc =
        currentDisc.length === derived.disciplines.length &&
        derived.disciplines.every((d) => currentDisc.includes(d));
      if (!sameDisc || p.socio !== derived.socio) {
        await event.data?.ref.update(derived);
      }
    }

    await notifyAdmins(
      "perfil-artista-creado",
      { nombre: p.artisticName ?? event.params.slug },
      "/admin/perfiles",
    );
  },
);

/**
 * Nueva solicitud de convenio (productor/beatmaker) → avisa a los admin
 * (in-app + push + WhatsApp, vía `notifyAdmins`). Best-effort: `notify` y
 * `notifyAdminWhatsApp` ya atrapan sus propios errores y nunca lanzan, así
 * que un fallo de notificación no bloquea la solicitud del usuario.
 */
export const onConvenioRequestCreated = onDocumentCreated(
  "convenioRequests/{id}",
  async (event) => {
    const req = event.data?.data();
    const ref = event.data?.ref;
    if (!req || !ref) return;
    const uid = req.uid as string | undefined;
    if (!uid) return;

    // Identidad AUTORITATIVA: deriva nombre/email del doc de usuario (no de los
    // campos que trae el cliente, que podrían estar falsificados) y reescríbelos
    // en la solicitud para que el panel admin muestre datos reales.
    const userData = (await db.doc(`users/${uid}`).get()).data();
    const nombre = userData?.displayName ?? userData?.email ?? "Un usuario";
    await ref.update({
      displayName: userData?.displayName ?? null,
      email: userData?.email ?? null,
    });

    // Dedup anti-flood: solo la PRIMERA solicitud pendiente del usuario avisa a
    // los admins; así un bucle de creaciones no spamea WhatsApp/campanita.
    const previas = await db
      .collection("convenioRequests")
      .where("uid", "==", uid)
      .get();
    const otraPendiente = previas.docs.some(
      (d) => d.id !== event.params.id && d.data().estado === "pendiente",
    );
    if (otraPendiente) return;

    await notifyAdmins(
      "convenio-solicitado",
      { tipo: req.tipo ?? "", nombre },
      "/admin/convenios",
    );
  },
);

// ── Recordatorios programados (crons) ─────────────────────────────────────────

/**
 * Recordatorio diario de gastos recurrentes por confirmar: por cada serie activa,
 * si la ocurrencia vigente del periodo aún no se confirmó NI se avisó, avisa a los
 * admin UNA sola vez (dedup vía `avisadoConfirm`). El backlog se ve in-app.
 */
export const recordatorioGastosRecurrentes = onSchedule(
  { schedule: "every 24 hours", region: REGION },
  async () => {
    const now = Date.now();
    const snap = await db
      .collection("movimientos")
      .where("recurrencia", "in", ["mensual", "anual"])
      .get();
    let avisos = 0;
    for (const doc of snap.docs) {
      const m = doc.data();
      if (m.anuladoAt) continue; // serie anulada
      const fechaMs = typeof m.fecha === "number" ? m.fecha : undefined;
      if (!fechaMs) continue;
      const hasta =
        typeof m.recurrenciaHasta === "number" ? m.recurrenciaHasta : undefined;
      const step = m.recurrencia === "anual" ? 12 : 1;

      // Ocurrencia vigente = la más reciente cuya fecha ya pasó.
      let last: number | null = null;
      for (let i = 0; i <= 1200; i++) {
        const ms = sumarMesesMs(fechaMs, i * step);
        if (ms > now || (hasta != null && ms > hasta)) break;
        last = ms;
      }
      if (last == null) continue;

      const key = claveOcurrencia(last, m.recurrencia);
      const confirmaciones = (m.confirmaciones ?? {}) as Record<
        string,
        unknown
      >;
      if (confirmaciones[key]) continue; // ya respondida
      const avisado: string[] = Array.isArray(m.avisadoConfirm)
        ? m.avisadoConfirm
        : [];
      if (avisado.includes(key)) continue; // ya avisada

      await notifyAdmins(
        "gasto-recurrente-por-confirmar",
        { concepto: m.concepto ?? "" },
        "/admin/gastos",
      );
      await doc.ref.update({ avisadoConfirm: FieldValue.arrayUnion(key) });
      avisos++;
    }
    if (avisos) {
      logger.info(
        `Recordatorio: ${avisos} gasto(s) recurrente(s) por confirmar`,
      );
    }
  },
);

/**
 * Recordatorio diario de perfiles premium por vencer (ventana de 7 días). Avisa al
 * dueño UNA vez por periodo de premium (dedup vía `renovacionAvisadaPara`, que
 * guarda el `expiresAt` ya avisado; al renovar cambia y se vuelve a avisar).
 */
export const recordatorioRenovacionPerfil = onSchedule(
  { schedule: "every 24 hours", region: REGION },
  async () => {
    const now = Date.now();
    const limite = now + 7 * 24 * 3_600_000; // 7 días
    const snap = await db.collection("artistProfiles").get();
    let avisos = 0;
    for (const doc of snap.docs) {
      const p = doc.data();
      const prem = p.premium;
      if (!prem?.activo || typeof prem.expiresAt !== "number") continue;
      if (prem.expiresAt <= now || prem.expiresAt > limite) continue; // fuera de ventana
      if (p.renovacionAvisadaPara === prem.expiresAt) continue; // ya avisado
      if (!p.uid) continue;
      const dias = Math.max(
        1,
        Math.ceil((prem.expiresAt - now) / (24 * 3_600_000)),
      );
      await notify(p.uid, "perfil-por-renovar", { dias }, "/artista/perfil");
      await doc.ref.update({ renovacionAvisadaPara: prem.expiresAt });
      avisos++;
    }
    if (avisos) logger.info(`Recordatorio: ${avisos} perfil(es) por renovar`);
  },
);

/**
 * Cotización ACEPTADA → genera la Reserva (server-authoritative): usa el precio
 * PROPUESTO por el estudio (`proposedPrice`), nunca uno del cliente. Reserva de
 * tipo `proyecto` (sin slot/fecha): se paga y el agendado se coordina en el chat.
 * Idempotente vía `bookingId` en el quote. Sin `proposedPrice` no crea nada.
 */
export const onQuoteAccepted = onDocumentUpdated(
  "quotes/{id}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const afterRef = event.data?.after.ref;
    if (!after || !afterRef) return;
    if (before?.status === "aceptada" || after.status !== "aceptada") return;
    if (after.bookingId) return; // ya generada → idempotente

    const amount =
      typeof after.proposedPrice === "number" ? after.proposedPrice : 0;
    if (amount <= 0) {
      logger.warn(
        `Cotización ${event.params.id} aceptada sin proposedPrice → no se crea reserva`,
      );
      return;
    }

    const items = Array.isArray(after.items) ? after.items : [];
    const serviceName =
      items
        .map((i: { serviceName?: string }) => i.serviceName)
        .filter(Boolean)
        .join(", ") || "Proyecto cotizado";

    const bookingRef = db.collection("bookings").doc();
    const batch = db.batch();
    batch.set(bookingRef, {
      uid: after.uid,
      tipo: "proyecto",
      serviceSlug: "proyecto",
      serviceName,
      sede: after.sede,
      start: 0,
      durationMin: 0,
      amount,
      quoteId: event.params.id,
      clientName: after.contactName ?? null,
      clientEmail: after.contactEmail ?? null,
      estado: "pendiente_pago",
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.update(afterRef, { bookingId: bookingRef.id });
    await batch.commit();

    logger.info(
      `Reserva ${bookingRef.id} generada desde cotización ${event.params.id}`,
    );
  },
);
