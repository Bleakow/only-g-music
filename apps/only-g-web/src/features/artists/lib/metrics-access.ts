import {
  DEFAULT_METRICS_VISIBILITY,
  type MetricsVisibility,
} from "@only-g/shared-types/profile-metrics";
import { effectiveDisciplines } from "@only-g/shared-types/artist-profile";
import {
  isSectionOn,
  type SectionPrefs,
} from "@only-g/shared-types/profile-sections";
import type { Role } from "@only-g/shared-types/user";
import { adminDb, verifiedUid } from "@/lib/firebase/admin";

/**
 * Puerta de acceso a las métricas de un perfil (SERVER-ONLY).
 *
 * Toda la decisión de "quién puede ver esto" vive AQUÍ y solo aquí. No está en
 * las reglas de Firestore a propósito: validar el token de un enlace compartido
 * desde una regla obligaría a guardarlo en un documento legible, y entonces
 * cualquiera podría leerlo y colarse. Con el Admin SDK, el token nunca sale del
 * servidor.
 */

export type AccessReason = "owner" | "admin" | "publico" | "enlace";

export interface AccessResult {
  ok: boolean;
  reason?: AccessReason;
  /** Datos del perfil que el panel necesita para titularse. */
  profile?: {
    slug: string;
    artisticName: string;
    uid: string;
    /**
     * ¿El perfil tiene encendida su parte musical (§05)? El ranking de
     * reproducciones lo alimentan TODOS los reproductores (temas, tema de intro
     * y media destacada), así que un bailarín también acumula datos ahí — pero
     * son reels, no canciones. Esto decide cómo se titula ese ranking.
     */
    esMusical: boolean;
  };
  visibility: MetricsVisibility;
  /** true si quien mira es el dueño (o admin): puede cambiar la visibilidad. */
  canManage: boolean;
}

const DENIED: AccessResult = {
  ok: false,
  visibility: DEFAULT_METRICS_VISIBILITY,
  canManage: false,
};

/** ¿La cuenta tiene rol admin o ceo? (mismo criterio que la regla `isAdmin`). */
async function isAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await adminDb.collection("users").doc(uid).get();
    const roles = (snap.data()?.roles as string[] | undefined) ?? [];
    return roles.includes("admin") || roles.includes("ceo");
  } catch {
    return false;
  }
}

/**
 * Resuelve si la petición puede ver las métricas de `slug`.
 *
 * Orden deliberado: primero se mira quién eres (dueño/admin) y solo después el
 * modo de compartir. Así el dueño entra siempre, aunque tenga las métricas en
 * privado, y conserva el permiso de gestión.
 */
export async function checkMetricsAccess(
  req: Request,
  slug: string,
  token: string | null,
): Promise<AccessResult> {
  const snap = await adminDb.collection("artistProfiles").doc(slug).get();
  if (!snap.exists) return DENIED;
  const data = snap.data() ?? {};
  // MISMA lectura que hace el repo del perfil público: sin el fallback, un
  // cantante anterior a §05 (sin `disciplines`) vería el panel de un bailarín.
  const disciplines = effectiveDisciplines(
    data.disciplines as Role[] | undefined,
  );
  const prefs = data.sectionPrefs as SectionPrefs | undefined;
  const profile = {
    slug,
    artisticName: String(data.artisticName ?? slug),
    uid: String(data.uid ?? ""),
    // Se pregunta al mismo dominio que decide qué pinta el perfil público, para
    // que el panel no invente su propia idea de "esto es un cantante".
    esMusical:
      isSectionOn("reproductor", prefs, disciplines) ||
      isSectionOn("canciones", prefs, disciplines),
  };
  const visibility =
    (data.metricsVisibility as MetricsVisibility | undefined) ??
    DEFAULT_METRICS_VISIBILITY;

  const uid = await verifiedUid(req);
  if (uid && profile.uid && uid === profile.uid) {
    return { ok: true, reason: "owner", profile, visibility, canManage: true };
  }
  if (uid && (await isAdmin(uid))) {
    return { ok: true, reason: "admin", profile, visibility, canManage: true };
  }

  if (visibility === "publico") {
    return {
      ok: true,
      reason: "publico",
      profile,
      visibility,
      canManage: false,
    };
  }

  if (visibility === "enlace" && token) {
    const priv = await adminDb
      .collection("artistProfiles")
      .doc(slug)
      .collection("private")
      .doc("metrics")
      .get();
    const real = priv.data()?.shareToken as string | undefined;
    // Comparación en tiempo constante: con `===` la diferencia de tiempo al
    // fallar en el primer carácter frente al último es medible y filtra el token.
    if (real && safeEqual(real, token)) {
      return {
        ok: true,
        reason: "enlace",
        profile,
        visibility,
        canManage: false,
      };
    }
  }

  return { ...DENIED, visibility };
}

/** Comparación de strings que no cortocircuita al primer carácter distinto. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
