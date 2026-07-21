import type { NextRequest } from "next/server";
import type { BioRequest, BioResponse } from "@only-g/ai-services";
import { geminiGenerate } from "@/features/ai/gemini";
import { verifiedUid } from "@/lib/firebase/admin";

export const runtime = "nodejs";

// Mejorar biografía: baja frecuencia, texto corto. Flash-Lite escribe bien en la
// capa gratis; para más chispa, sube vía ONLYG_GEMINI_BIO_MODEL (guardarraíl: gemini-*).
const MODEL = process.env.ONLYG_GEMINI_BIO_MODEL ?? "gemini-flash-lite-latest";

const SYSTEM = `Eres editor de biografías para perfiles de artistas musicales. Escribes bios profesionales, con gancho y sin clichés de IA ("apasionado", "polifacético", "único e inigualable", "desde muy pequeño"). Respetas lo que el artista dice de sí mismo (género, ciudad, historia) y NO inventas logros, premios, cifras ni fechas que no te hayan dado. Tono cercano pero con oficio. Responde SIEMPRE en el mismo idioma del germen.`;

export async function POST(req: NextRequest): Promise<Response> {
  // Puerta: sin ID token válido de nuestro proyecto, ni se lee el body ni se
  // toca Gemini. Es lo que impide que un desconocido queme la cuota.
  const uid = await verifiedUid(req);
  if (!uid) return unauthorized();

  let body: BioRequest;
  try {
    body = (await req.json()) as BioRequest;
  } catch {
    return json({ variants: [], source: "stub" }, 400);
  }
  if (!body.seed?.trim()) {
    return json({ variants: [], source: "stub" }, 400);
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
      maxOutputTokens: 700,
      temperature: 0.9,
      json: true,
    });
    const variants = parseVariants(raw).slice(0, 2);
    // Si el modelo devolvió vacío/ilegible, no dejamos al usuario sin nada.
    if (variants.length === 0) return json(stub(body));
    return json({ variants, source: "ai" });
  } catch (err) {
    console.error("ai/bio:", err);
    return json(stub(body));
  }
}

function buildPrompt(body: BioRequest): string {
  const facts: string[] = [];
  if (body.name?.trim()) facts.push(`Nombre artístico: ${body.name.trim()}`);
  if (body.city?.trim()) facts.push(`Origen: ${body.city.trim()}`);
  const genres = (body.genres ?? [])
    .map((g) => g?.trim())
    .filter(Boolean)
    .join(", ");
  if (genres) facts.push(`Géneros: ${genres}`);
  if (body.startYear && body.startYear > 1900) {
    facts.push(`Activo desde: ${body.startYear}`);
  }
  const ctx = facts.length
    ? `\n\nDatos del artista (úsalos si encajan, no inventes otros):\n${facts.join("\n")}`
    : "";

  return `A partir de esta idea del artista, escribe DOS biografías profesionales, distintas entre sí: la primera sobria y directa; la segunda con más carácter y gancho. Cada una de 60 a 90 palabras, en el mismo idioma de la idea, sin inventar logros ni cifras.${ctx}

Idea del artista:
"${body.seed.trim()}"

Responde SOLO con un objeto JSON: {"variants": ["biografía 1", "biografía 2"]}.`;
}

/** Parseo defensivo: acepta el objeto, un array pelado o texto con ```json ```. */
function parseVariants(raw: string): string[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { variants?: unknown })?.variants)
        ? (parsed as { variants: unknown[] }).variants
        : [];
    return list
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
  } catch {
    return [];
  }
}

/** Sin API key: dos bios plausibles a partir del germen, para que el flujo se
 *  pruebe en dev sin secretos. No es IA, es relleno determinista. */
function stub(body: BioRequest): BioResponse {
  const seed = body.seed.trim().replace(/\s+/g, " ");
  const seedCore = seed.replace(/[.!?]+$/, "");
  const seedCap = seedCore.charAt(0).toUpperCase() + seedCore.slice(1);
  const name = body.name?.trim() || "Este artista";
  const city = body.city?.trim();
  const origin = city ? ` Originario de ${city},` : "";
  const genres = (body.genres ?? []).map((g) => g?.trim()).filter(Boolean);
  const sound = genres.length ? genres.join(" y ") : "su propio estilo";
  return {
    variants: [
      `${seedCap}.${origin} ${name} ha ido forjando una voz reconocible dentro de ${sound}, con canciones que hablan de su entorno y su recorrido sin adornos prestados.`,
      `${name} no se explica: se escucha.${origin} entre ${sound}, convierte una idea simple —"${seedCore}"— en una propuesta con carácter, pensada para quien busca artistas de verdad y no fórmulas.`,
    ],
    source: "stub",
  };
}

function json(payload: BioResponse, status = 200): Response {
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
