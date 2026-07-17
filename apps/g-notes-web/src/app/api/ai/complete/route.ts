import type { NextRequest } from "next/server";
import type {
  CompletionRequest,
  CompletionResponse,
} from "@only-g/ai-services";
import { geminiGenerate } from "@/features/ai/gemini";
import { verifiedUid } from "@/lib/firebase/admin";

// Precursor del servicio @only-g/ai-engine: por ahora vive como route handler
// de g-notes-web. Guarda la key server-side; el cliente nunca la ve.
export const runtime = "nodejs";

// Autocompletado inline = alta frecuencia + latencia crítica → Flash-Lite
// (rápido, barato, con capa gratis). El alias "-latest" evita los 404 de
// modelos retirados. Override con GNOTES_GEMINI_MODEL.
const MODEL = process.env.GNOTES_GEMINI_MODEL ?? "gemini-flash-lite-latest";

const SYSTEM = `Eres el autocompletado de un editor de composición musical (como GitHub Copilot, pero para letras de canciones). Continúa el texto de forma natural en el MISMO idioma, estilo, tema, métrica y patrón de rima. Devuelve SOLO la continuación en texto plano: sin comillas, sin explicaciones y sin repetir lo ya escrito. Si el verso parece completo, empieza el siguiente. Máximo una o dos líneas.`;

export async function POST(req: NextRequest): Promise<Response> {
  // Puerta: sin ID token válido de nuestro proyecto, ni se lee el body ni se
  // toca Gemini. Es lo que impide que un desconocido queme la cuota.
  const uid = await verifiedUid(req);
  if (!uid) return unauthorized();

  let body: CompletionRequest;
  try {
    body = (await req.json()) as CompletionRequest;
  } catch {
    return json({ suggestion: "", source: "stub" }, 400);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(stub(body));

  // Modelo elegido por el usuario (guardarraíl: solo gemini-*), si no el default.
  const model = body.model?.startsWith("gemini") ? body.model : MODEL;
  try {
    const text = await geminiGenerate({
      apiKey,
      model,
      system: SYSTEM,
      prompt: buildPrompt(body),
      maxOutputTokens: 48,
      temperature: 0.9,
    });
    return json({ suggestion: text.trim(), source: "ai" });
  } catch (err) {
    // Nunca romper la escritura por un fallo del modelo: degradar al stub.
    console.error("ai/complete:", err);
    return json(stub(body));
  }
}

function buildPrompt(body: CompletionRequest): string {
  const genre = body.genre?.trim() || "no especificado";
  const meter = body.targetMeter
    ? `${body.targetMeter} sílabas por verso (mantén la coherencia métrica)`
    : "libre";
  const prefix = body.prefix.slice(-1500);
  return `Género: ${genre}. Métrica objetivo: ${meter}.
Continúa esta letra a partir del final (no repitas lo ya escrito):

${prefix}`;
}

/** Stub determinista sin API key: continúa el verso con una imagen breve. */
function stub(body: CompletionRequest): CompletionResponse {
  const POOL = [
    " y en el silencio encontré tu voz",
    " bajo una luna que no vuelve",
    " como un eco que no se apaga",
    " y el tiempo se detuvo ahí",
    " donde el mundo aprende a callar",
    " y aún te busco en cada canción",
  ];
  const prefix = body.prefix.trimEnd();
  const suggestion = prefix ? POOL[prefix.length % POOL.length] : "";
  return { suggestion, source: "stub" };
}

function json(payload: CompletionResponse, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
