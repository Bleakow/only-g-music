import type { NextRequest } from "next/server";
import type {
  CreativeOp,
  CreativeRequest,
  CreativeResponse,
} from "@only-g/ai-services";
import { geminiGenerate } from "@/features/ai/gemini";

export const runtime = "nodejs";

// Panel contextual: menor frecuencia. Flash-Lite (alias -latest) funciona en la
// capa gratis y escribe bien; para más chispa, sube a gemini-flash-latest o
// gemini-3.5-flash vía GNOTES_GEMINI_CREATIVE_MODEL.
const MODEL = process.env.GNOTES_GEMINI_CREATIVE_MODEL ?? "gemini-flash-lite-latest";

const INSTRUCTIONS: Record<CreativeOp, string> = {
  rimas:
    "Devuelve entre 6 y 10 palabras o expresiones que rimen con la selección (rima consonante, asonante y multisilábica), coherentes con el género. Cada opción es solo la palabra o expresión.",
  frases:
    "Devuelve 6 reformulaciones o variaciones creativas de la selección, con matices de significado distintos pero manteniendo el tono.",
  metaforas:
    "Convierte la selección en 6 imágenes poéticas: metáforas, comparaciones creativas y recursos literarios.",
  expandir:
    "Continúa la idea de la selección con 5 posibles versos siguientes, coherentes en métrica, rima y tono.",
};

const SYSTEM = `Eres el panel contextual de un editor de composición musical. Ayudas al compositor sin reemplazarlo: propones opciones breves, frescas y coherentes con su letra. Responde en el mismo idioma de la selección.`;

export async function POST(req: NextRequest): Promise<Response> {
  let body: CreativeRequest;
  try {
    body = (await req.json()) as CreativeRequest;
  } catch {
    return json({ op: "rimas", suggestions: [], source: "stub" }, 400);
  }
  if (!INSTRUCTIONS[body.op]) {
    return json({ op: body.op, suggestions: [], source: "stub" }, 400);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(stub(body));

  // Modelo elegido por el usuario (guardarraíl: solo gemini-*), si no el default.
  const model = body.model?.startsWith("gemini") ? body.model : MODEL;
  try {
    const raw = await geminiGenerate({
      apiKey,
      model,
      system: SYSTEM,
      prompt: buildPrompt(body),
      maxOutputTokens: 400,
      temperature: 1.0,
      json: true,
    });
    return json({ op: body.op, suggestions: parseSuggestions(raw), source: "ai" });
  } catch (err) {
    console.error("ai/tools:", err);
    return json(stub(body));
  }
}

function buildPrompt(body: CreativeRequest): string {
  const genre = body.genre?.trim() || "no especificado";
  const context = body.context?.trim()
    ? `\n\nContexto (canción alrededor):\n${body.context.slice(-800)}`
    : "";
  return `Género: ${genre}.
${INSTRUCTIONS[body.op]}

Selección:
"${body.text.trim()}"${context}

Responde SOLO con un objeto JSON: {"suggestions": ["opción 1", "opción 2", ...]}.`;
}

/** Parseo defensivo: acepta el objeto, un array pelado o texto con ```json ```. */
function parseSuggestions(raw: string): string[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { suggestions?: unknown })?.suggestions)
        ? (parsed as { suggestions: unknown[] }).suggestions
        : [];
    return list.filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function stub(body: CreativeRequest): CreativeResponse {
  const POOLS: Record<CreativeOp, string[]> = {
    rimas: ["ciudad", "verdad", "soledad", "tempestad", "libertad", "realidad"],
    frases: [
      "dicho de otra forma",
      "una versión más honesta",
      "lo mismo, con más filo",
      "girando la imagen",
    ],
    metaforas: [
      "como un faro en la tormenta",
      "un río que no encuentra el mar",
      "ceniza de un fuego que fue casa",
    ],
    expandir: [
      "y seguí caminando sin mirar atrás",
      "mientras la noche me enseñaba a hablar",
      "buscando en el ruido una señal",
    ],
  };
  return { op: body.op, suggestions: POOLS[body.op] ?? [], source: "stub" };
}

function json(payload: CreativeResponse, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
