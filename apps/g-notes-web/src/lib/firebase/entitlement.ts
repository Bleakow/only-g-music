import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  FREE_AI_LIMIT_DIA,
  gnotesActiva,
  gnotesUsageDocId,
  type GNotesMembership,
} from "@only-g/shared-types/gnotes-membership";
import { adminApp } from "./admin";

/**
 * Gate FREEMIUM de la IA de G Notes (server-side). Cada llamada real a Gemini
 * pasa por aquí:
 *   - MIEMBRO (users/{uid}.gnotesPremium vigente) → IA sin límite.
 *   - GRATIS → consume 1 del contador diario (gnotesUsage/{uid}_{fecha}); al
 *     llegar a FREE_AI_LIMIT_DIA se bloquea (allowed=false).
 *
 * FAIL-OPEN: si Firestore no está disponible (p. ej. dev local sin credencial
 * por defecto), NO se bloquea la escritura — la puerta de auth (`verifiedUid`)
 * ya impide el abuso anónimo, y romper el autocompletado del compositor por un
 * problema de infraestructura sería peor que dejar pasar unas llamadas de más.
 */
export interface QuotaResult {
  /** ¿Se permite esta llamada a la IA? */
  allowed: boolean;
  /** Sugerencias gratis restantes hoy. `null` = sin límite (miembro o fail-open). */
  remaining: number | null;
  /** El tope diario gratis vigente (para mensajería en el cliente). */
  limit: number;
}

const db = getFirestore(adminApp);

/**
 * Caché en memoria del estado de membresía por uid (TTL corto). El ghost es
 * latency-critical: leer `users/{uid}` en cada llamada le añade una ida a
 * Firestore. Con la caché, un miembro salta TODA la comprobación durante la
 * ventana; un cambio de membresía (alta/expiración) tarda como mucho `MEMBER_TTL_MS`
 * en reflejarse — aceptable. Se vacía al reciclar la instancia de Cloud Run.
 */
const MEMBER_TTL_MS = 60_000;
const memberCache = new Map<string, { member: boolean; until: number }>();

async function isMember(uid: string, now: number): Promise<boolean> {
  const cached = memberCache.get(uid);
  if (cached && cached.until > now) return cached.member;
  const userSnap = await db.doc(`users/${uid}`).get();
  const membership = userSnap.data()?.gnotesPremium as
    | GNotesMembership
    | undefined;
  const member = gnotesActiva(membership, now);
  memberCache.set(uid, { member, until: now + MEMBER_TTL_MS });
  return member;
}

/**
 * Comprueba membresía y, si es usuario gratis, consume 1 del cupo diario de
 * forma ATÓMICA (transacción: lee el contador y solo incrementa si está bajo el
 * tope). Devuelve si se permite y cuántas quedan. Llamar SOLO cuando se va a
 * hacer una llamada real al modelo (no en modo stub sin API key).
 */
export async function consumeAiQuota(uid: string): Promise<QuotaResult> {
  try {
    const now = Date.now();
    // 1) ¿Miembro? → IA sin límite, ni se toca el contador (con caché corta).
    if (await isMember(uid, now)) {
      return { allowed: true, remaining: null, limit: FREE_AI_LIMIT_DIA };
    }

    // 2) Gratis → consumir del contador diario (un doc por uid y día).
    const ref = db.doc(`gnotesUsage/${gnotesUsageDocId(uid, now)}`);
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = (snap.data()?.count as number | undefined) ?? 0;
      if (count >= FREE_AI_LIMIT_DIA) {
        return { allowed: false, remaining: 0, limit: FREE_AI_LIMIT_DIA };
      }
      tx.set(
        ref,
        { uid, count: count + 1, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return {
        allowed: true,
        remaining: FREE_AI_LIMIT_DIA - (count + 1),
        limit: FREE_AI_LIMIT_DIA,
      };
    });
  } catch (e) {
    // FAIL-OPEN: no romper la escritura por un fallo de infraestructura.
    console.error("[entitlement] consumeAiQuota fail-open:", e);
    return { allowed: true, remaining: null, limit: FREE_AI_LIMIT_DIA };
  }
}
