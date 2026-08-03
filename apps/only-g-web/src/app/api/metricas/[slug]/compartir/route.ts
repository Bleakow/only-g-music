import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import {
  DEFAULT_METRICS_VISIBILITY,
  type MetricsVisibility,
} from "@only-g/shared-types/profile-metrics";
import { adminDb } from "@/lib/firebase/admin";
import { checkMetricsAccess } from "@/features/artists/lib/metrics-access";

export const runtime = "nodejs";

/**
 * Gestión del COMPARTIR de las métricas (§04). Solo el dueño (o un admin) puede
 * tocar esto: `checkMetricsAccess` devuelve `canManage` únicamente para ellos.
 *
 * Estados:
 *  · `privado`  — solo tú. Es el de por defecto.
 *  · `enlace`   — cualquiera con la URL que lleva `?k=<token>`.
 *  · `publico`  — cualquiera, y el botón "Métricas" sale en tu perfil.
 *
 * El token vive en `artistProfiles/{slug}/private/metrics`, un documento que las
 * reglas cierran al cliente. Si viviera en el perfil (que es de lectura
 * pública), cualquiera podría leerlo y colarse — que es justo lo que evitamos.
 */

/** 32 caracteres hex: 128 bits. Ni se adivina ni se enumera por fuerza bruta. */
function newToken(): string {
  return randomBytes(16).toString("hex");
}

interface Body {
  visibility?: string;
  /** Pide un token nuevo, invalidando el enlace anterior. */
  rotate?: boolean;
}

const VALID: MetricsVisibility[] = ["privado", "enlace", "publico"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;

  // Se pasa `null` como token a propósito: para GESTIONAR no basta con tener el
  // enlace. Quien recibe unas métricas compartidas puede verlas, no reconfigurarlas.
  const access = await checkMetricsAccess(req, slug, null);
  if (!access.ok || !access.canManage) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const visibility = VALID.includes(body.visibility as MetricsVisibility)
    ? (body.visibility as MetricsVisibility)
    : access.visibility;

  const perfil = adminDb.collection("artistProfiles").doc(slug);
  const privado = perfil.collection("private").doc("metrics");

  try {
    const actual = (await privado.get()).data()?.shareToken as
      | string
      | undefined;

    // Se genera token la primera vez que se activa el modo enlace, o cuando el
    // artista pide expresamente uno nuevo (que revoca el anterior de golpe).
    const necesitaToken = visibility === "enlace" && (!actual || body.rotate);
    const token = necesitaToken ? newToken() : actual;

    await perfil.set({ metricsVisibility: visibility }, { merge: true });
    if (token && token !== actual) {
      await privado.set({ shareToken: token }, { merge: true });
    }

    return Response.json({
      visibility,
      // El token solo se devuelve a quien puede gestionar, y solo en modo enlace:
      // en privado o público no hay enlace que enseñar.
      token: visibility === "enlace" ? (token ?? null) : null,
    });
  } catch (e) {
    console.error("[metricas] compartir:", e);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

/** Estado actual del compartir (para pintar el panel sin adivinar). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const access = await checkMetricsAccess(req, slug, null);
  if (!access.ok || !access.canManage) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const priv = await adminDb
      .collection("artistProfiles")
      .doc(slug)
      .collection("private")
      .doc("metrics")
      .get();
    const token = priv.data()?.shareToken as string | undefined;
    return Response.json({
      visibility: access.visibility ?? DEFAULT_METRICS_VISIBILITY,
      token: access.visibility === "enlace" ? (token ?? null) : null,
    });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
