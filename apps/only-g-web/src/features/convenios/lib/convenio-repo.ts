/**
 * Repositorio (data-access) de solicitudes de convenio (productor/beatmaker):
 * `convenioRequests/{id}`. La UI nunca toca Firestore directo. La aprobación
 * y el rechazo otorgan/deniegan un rol, así que van por Cloud Functions
 * server-authoritative — las reglas de Firestore bloquean `update`/`delete`
 * desde el cliente (ver `firestore.rules`, match /convenioRequests/{id}).
 */
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import type { ConvenioRequest, NuevaConvenioRequest } from "@only-g/shared-types/convenio";

const COLLECTION = "convenioRequests";

function toConvenio(id: string, d: DocumentData): ConvenioRequest {
  return {
    id,
    uid: d.uid,
    displayName: d.displayName ?? null,
    email: d.email ?? null,
    tipo: d.tipo,
    estado: d.estado,
    mensaje: d.mensaje ?? undefined,
    createdAt: d.createdAt?.toMillis?.() ?? Date.now(),
    resueltoAt: typeof d.resueltoAt === "number" ? d.resueltoAt : undefined,
    motivo: d.motivo ?? undefined,
  };
}

/**
 * Crea la solicitud de convenio con estado inicial "pendiente". Omite campos
 * opcionales vacíos (Firestore rechaza `undefined`). Devuelve el id creado.
 */
export async function createConvenioRequest(
  nueva: NuevaConvenioRequest,
): Promise<string> {
  const payload: Record<string, unknown> = {
    estado: "pendiente",
    createdAt: serverTimestamp(),
  };
  for (const [key, value] of Object.entries(nueva)) {
    if (value !== undefined) payload[key] = value;
  }

  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

/**
 * La solicitud pendiente del usuario, si tiene una (para bloquear un segundo
 * envío mientras espera respuesta). Las reglas solo permiten leer las propias.
 */
export async function getMyPendingConvenio(
  uid: string,
): Promise<ConvenioRequest | null> {
  const q = query(
    collection(db, COLLECTION),
    where("uid", "==", uid),
    where("estado", "==", "pendiente"),
    limit(1),
  );
  const snap = await getDocs(q);
  return snap.empty ? null : toConvenio(snap.docs[0].id, snap.docs[0].data());
}

// ── Admin (requiere rol admin por reglas) ──────────────────────────

/** Todas las solicitudes de convenio, más recientes primero (SOLO admin). */
export async function listConvenioRequests(): Promise<ConvenioRequest[]> {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toConvenio(d.id, d.data()));
}

const aprobarConvenioFn = httpsCallable<
  { requestId: string; sedeId?: string },
  { ok: boolean }
>(functions, "aprobarConvenio");

/**
 * Aprueba una solicitud (SOLO admin): otorga el rol de convenio —`productor`
 * exige `sedeId`, `beatmaker` no— y sincroniza el perfil vinculado si existe.
 */
export async function aprobarConvenio(
  requestId: string,
  sedeId?: string,
): Promise<void> {
  await aprobarConvenioFn({ requestId, sedeId });
}

const rechazarConvenioFn = httpsCallable<
  { requestId: string; motivo?: string },
  { ok: boolean }
>(functions, "rechazarConvenio");

/** Rechaza una solicitud (SOLO admin). No otorga ningún rol. */
export async function rechazarConvenio(
  requestId: string,
  motivo?: string,
): Promise<void> {
  await rechazarConvenioFn({ requestId, motivo });
}
