import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  DAY_DOC_PREFIX,
  METRICS_RANGES,
  DEFAULT_METRICS_RANGE,
  dayKey,
  lastDayKeys,
  sumDays,
  type MetricEvent,
  type MetricsDay,
  type MetricsRange,
  type PlaySource,
  type ShareChannel,
} from "@only-g/shared-types/profile-metrics";
import { adminDb } from "@/lib/firebase/admin";
import { countryFromClient } from "@/features/artists/lib/geo-timezone";
import { checkMetricsAccess } from "@/features/artists/lib/metrics-access";

export const runtime = "nodejs";

/**
 * Registro de métricas del perfil (§04).
 *
 * POR QUÉ PASA POR EL SERVIDOR y no escribe el cliente directamente:
 *  1. La subcolección `metrics` está CERRADA en las reglas, así que nadie puede
 *     fabricarse contadores a medida desde la consola del navegador.
 *  2. El país se deduce aquí (la tabla de husos horarios no viaja al cliente).
 *  3. Se normaliza y se acota lo que llega: un evento solo puede sumar +1 a los
 *     campos que este archivo permite, nunca a un campo arbitrario.
 *
 * Sigue siendo una métrica de VANIDAD: cualquiera puede llamar a este endpoint
 * en bucle. Se mitiga (dedup por sesión en cliente, un solo +1 por petición),
 * no se elimina — eliminarlo exigiría exigir login para ver un perfil público.
 */

/** Nombres de tema aceptados: recortados, para no guardar basura como clave. */
const MAX_KEY = 80;

const SHARE_CHANNELS: ShareChannel[] = [
  "whatsapp",
  "copy",
  "native",
  "instagram",
  "x",
  "facebook",
  "otros",
];

const PLAY_SOURCES: PlaySource[] = ["intro", "destacado", "youtube", "spotify"];

/** Redes válidas para `socialClick` (mismas claves que `SocialPlatform`). */
const SOCIAL_PLATFORMS = [
  "instagram",
  "spotify",
  "youtube",
  "tiktok",
  "x",
  "facebook",
  "threads",
];

interface Body {
  evento?: string;
  /** `play`: de dónde salió la reproducción. */
  origen?: string;
  /** `play`: título del tema (para el ranking de canciones). */
  cancion?: string;
  /** `share`: por dónde se compartió. */
  canal?: string;
  /** `socialClick`: a qué red se fue. */
  red?: string;
  /** `visita`: señales del navegador para deducir el país. */
  tz?: string;
  locale?: string;
}

/** Clave segura para un mapa de Firestore: sin puntos ni barras, y acotada. */
function safeKey(raw: string): string | null {
  const s = raw.trim().replace(/[./[\]*~]/g, " ").replace(/\s+/g, " ");
  if (!s) return null;
  return s.slice(0, MAX_KEY);
}

/**
 * Lectura del panel. Devuelve el periodo pedido, el periodo ANTERIOR de igual
 * tamaño (para las variaciones) y la serie diaria.
 *
 * Coste: `rango × 2` lecturas de documento + 1 del perfil. Con 30 días son 61,
 * y solo las paga quien abre el panel.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("k");

  const access = await checkMetricsAccess(req, slug, token);
  if (!access.ok || !access.profile) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const pedido = Number(url.searchParams.get("rango"));
  const rango: MetricsRange = (METRICS_RANGES as readonly number[]).includes(
    pedido,
  )
    ? (pedido as MetricsRange)
    : DEFAULT_METRICS_RANGE;

  const hoy = new Date();
  const diasActual = lastDayKeys(rango, hoy);
  // El periodo anterior termina justo el día antes de que empiece el actual.
  const finPrevio = new Date(hoy.getTime() - rango * 86_400_000);
  const diasPrevio = lastDayKeys(rango, finPrevio);

  const base = adminDb
    .collection("artistProfiles")
    .doc(slug)
    .collection("metrics");

  try {
    const [actualDocs, previoDocs, totalsSnap] = await Promise.all([
      readDays(base, diasActual),
      readDays(base, diasPrevio),
      base.doc("totals").get(),
    ]);

    return Response.json({
      perfil: {
        slug: access.profile.slug,
        artisticName: access.profile.artisticName,
      },
      rango,
      visibility: access.visibility,
      canManage: access.canManage,
      actual: sumDays(actualDocs),
      previo: sumDays(previoDocs),
      serie: actualDocs,
      totales: totalsSnap.data() ?? {},
    });
  } catch (e) {
    console.error("[metricas] lectura:", e);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

/** Lee los docs de N días. Los que no existen (días sin tráfico) valen 0. */
async function readDays(
  base: FirebaseFirestore.CollectionReference,
  dias: string[],
): Promise<MetricsDay[]> {
  if (dias.length === 0) return [];
  const refs = dias.map((d) => base.doc(`${DAY_DOC_PREFIX}${d}`));
  const snaps = await adminDb.getAll(...refs);
  return snaps.map((s, i) => ({
    ...(s.data() ?? {}),
    dia: dias[i],
  })) as MetricsDay[];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!slug || slug.length > 120) return new Response(null, { status: 400 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(null, { status: 400 });
  }

  const evento = body.evento as MetricEvent | undefined;
  if (
    evento !== "visita" &&
    evento !== "play" &&
    evento !== "share" &&
    evento !== "socialClick"
  ) {
    return new Response(null, { status: 400 });
  }

  // Un evento = exactamente +1 en su contador, más como mucho un +1 en un mapa.
  // Se construye aquí para que el cliente no elija qué campos toca.
  const inc: Record<string, FieldValue> = {};
  const one = FieldValue.increment(1);

  if (evento === "visita") {
    inc.visitas = one;
    const pais = countryFromClient(body.tz, body.locale);
    if (pais) inc[`porPais.${pais}`] = one;
  } else if (evento === "play") {
    inc.plays = one;
    const origen = PLAY_SOURCES.includes(body.origen as PlaySource)
      ? (body.origen as PlaySource)
      : null;
    if (origen) inc[`porOrigen.${origen}`] = one;
    const cancion = body.cancion ? safeKey(body.cancion) : null;
    if (cancion) inc[`porCancion.${cancion}`] = one;
  } else if (evento === "share") {
    inc.shares = one;
    const canal = SHARE_CHANNELS.includes(body.canal as ShareChannel)
      ? (body.canal as ShareChannel)
      : "otros";
    inc[`porCanal.${canal}`] = one;
  } else {
    inc.socialClicks = one;
    const red = SOCIAL_PLATFORMS.includes(body.red ?? "") ? body.red! : null;
    if (red) inc[`porRed.${red}`] = one;
  }

  const dia = dayKey(new Date());
  const perfil = adminDb.collection("artistProfiles").doc(slug);
  const base = perfil.collection("metrics");

  try {
    // `merge`/`set` con increments crea el doc si no existe. Se escriben los dos
    // en lote: o cuadran ambos, o no cuadra ninguno.
    const batch = adminDb.batch();
    batch.set(base.doc("totals"), inc, { merge: true });
    batch.set(
      base.doc(`${DAY_DOC_PREFIX}${dia}`),
      { ...inc, dia },
      { merge: true },
    );
    // El perfil público enseña `visitas` en su tarjeta de estadísticas, así que
    // ese contador se sigue alimentando aquí. Es la ÚNICA vía que queda: las
    // reglas ya no dejan al cliente tocarlo.
    if (evento === "visita") {
      batch.set(perfil, { visitas: one }, { merge: true });
    }
    await batch.commit();
  } catch (e) {
    // Una métrica que falla NUNCA debe romper la visita: se traga el error.
    console.error("[metricas] registro:", e);
    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 204 });
}
