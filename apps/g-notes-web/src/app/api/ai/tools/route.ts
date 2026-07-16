import type { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  CreativeOp,
  CreativeRequest,
  CreativeResponse,
} from "@only-g/ai-services";

export const runtime = "nodejs";

// El panel contextual es de menor frecuencia que el autocompletado y la calidad
// creativa importa → Opus 4.8 por defecto. Override GNOTES_AI_CREATIVE_MODEL.
const MODEL = process.env.GNOTES_AI_CREATIVE_MODEL ?? "claude-opus-4-8";

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

const SCHEMA = {
  type: "object",
  properties: {
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(stub(body));

  try {
    const suggestions = await creativeWithClaude(body, apiKey);
    return json({ op: body.op, suggestions, source: "ai" });
  } catch (err) {
    console.error("ai/tools:", err);
    return json(stub(body));
  }
}

async function creativeWithClaude(
  body: CreativeRequest,
  apiKey: string,
): Promise<string[]> {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: buildPrompt(body) }],
  });
  const block = res.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text : "{}";
  const parsed = JSON.parse(raw) as { suggestions?: unknown };
  const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  return list.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

function buildPrompt(body: CreativeRequest): string {
  const genre = body.genre?.trim() || "no especificado";
  const context = body.context?.trim()
    ? `\n\nContexto (canción alrededor):\n${body.context.slice(-800)}`
    : "";
  return `Género: ${genre}.
${INSTRUCTIONS[body.op]}

Selección:
"${body.text.trim()}"${context}`;
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
