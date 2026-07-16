import type { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  CompletionRequest,
  CompletionResponse,
} from "@only-g/ai-services";

// Precursor del servicio @only-g/ai-engine: por ahora vive como route handler
// de g-notes-web. Guarda la key server-side; el cliente nunca la ve.
export const runtime = "nodejs";

// Autocompletado inline = alta frecuencia + latencia crítica → Haiku 4.5 por
// defecto (rápido/barato). Override con GNOTES_AI_MODEL (p. ej. claude-opus-4-8).
const MODEL = process.env.GNOTES_AI_MODEL ?? "claude-haiku-4-5";

const SYSTEM = `Eres el autocompletado de un editor de composición musical (como GitHub Copilot, pero para letras de canciones). Continúa el texto de forma natural en el MISMO idioma, estilo, tema, métrica y patrón de rima. Devuelve SOLO la continuación en texto plano: sin comillas, sin explicaciones y sin repetir lo ya escrito. Si el verso parece completo, empieza el siguiente. Máximo una o dos líneas.`;

export async function POST(req: NextRequest): Promise<Response> {
  let body: CompletionRequest;
  try {
    body = (await req.json()) as CompletionRequest;
  } catch {
    return json({ suggestion: "", source: "stub" }, 400);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(stub(body));
  }

  try {
    const suggestion = await completeWithClaude(body, apiKey);
    return json({ suggestion, source: "ai" });
  } catch (err) {
    // Nunca romper la escritura por un fallo del modelo: degradar al stub.
    console.error("ai/complete:", err);
    return json(stub(body));
  }
}

async function completeWithClaude(
  body: CompletionRequest,
  apiKey: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 48,
    system: SYSTEM,
    messages: [{ role: "user", content: buildPrompt(body) }],
  });
  const block = res.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "";
  return text.trim();
}

function buildPrompt(body: CompletionRequest): string {
  const genre = body.genre?.trim() || "no especificado";
  const meter = body.targetMeter
    ? `${body.targetMeter} sílabas por verso (mantén la coherencia métrica)`
    : "libre";
  // Acotar el contexto para controlar tokens/latencia.
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
