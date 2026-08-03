import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { geminiGenerate } from "@/features/ai/gemini";
import { perfilVisible } from "@only-g/shared-types/artist-profile";
import { normalizeText } from "@only-g/shared-types/talent-directory";

export const runtime = "nodejs";

// Búsqueda semántica del directorio: la app le manda una consulta en lenguaje
// natural (apariencia, voz, estilo o temática) y devolvemos los slugs de los
// perfiles que mejor encajan. Las FICHAS (searchIndex, privadas) se leen aquí en
// servidor y NUNCA salen al cliente — solo devolvemos slugs.
//
// Público a propósito (el diseño §03 lo muestra a cualquier visitante). Acotado:
// consulta corta, candidatos limitados, modelo barato. Endurecer con App Check /
// rate-limit queda como mejora futura.
const MODEL = process.env.ONLYG_GEMINI_SEARCH_MODEL ?? "gemini-flash-lite-latest";
const MAX_QUERY = 200;
const MAX_CANDIDATES = 80;
const MAX_RESULTS = 30;

const SYSTEM = `Eres el buscador de un directorio profesional de artistas y talento. Recibes una consulta en lenguaje natural (puede describir apariencia física, tipo de voz, estilo musical o temática) y una lista de candidatos, cada uno con su ficha. Devuelve los SLUGS de los candidatos que MEJOR coinciden con la consulta, ordenados de más a menos relevante. Reglas: usa SOLO slugs de la lista; no inventes; si ninguno encaja de verdad, devuelve lista vacía; máximo 30.`;

interface SearchResponse {
  slugs: string[];
  source: "ai" | "stub";
}

interface Candidate {
  slug: string;
  name: string;
  genre: string;
  city: string;
  disciplines: string[];
  /** Texto buscable: ficha IA (si existe) + datos públicos. */
  haystack: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  let query = "";
  try {
    const body = (await req.json()) as { query?: unknown };
    query =
      typeof body.query === "string" ? body.query.trim().slice(0, MAX_QUERY) : "";
  } catch {
    return json({ slugs: [], source: "stub" }, 400);
  }
  if (query.length < 2) return json({ slugs: [], source: "stub" });

  let candidates: Candidate[];
  try {
    candidates = await loadCandidates();
  } catch (e) {
    // Sin credencial (local sin ADC) o sin red: no rompemos la búsqueda, el
    // cliente ya tiene su filtro de texto instantáneo como respaldo.
    console.error("ai/artistas load:", e);
    return json({ slugs: [], source: "stub" });
  }
  if (candidates.length === 0) return json({ slugs: [], source: "stub" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ slugs: keywordMatch(query, candidates), source: "stub" });
  }

  try {
    const raw = await geminiGenerate({
      apiKey,
      model: MODEL,
      system: SYSTEM,
      prompt: buildPrompt(query, candidates),
      maxOutputTokens: 400,
      temperature: 0.2,
      json: true,
    });
    const slugs = parseSlugs(raw, candidates);
    // Si el modelo no devolvió nada usable, caemos al match por palabras clave.
    if (slugs.length === 0) {
      return json({ slugs: keywordMatch(query, candidates), source: "stub" });
    }
    return json({ slugs, source: "ai" });
  } catch (e) {
    console.error("ai/artistas:", e);
    return json({ slugs: keywordMatch(query, candidates), source: "stub" });
  }
}

/** Perfiles VISIBLES (premium/socio) con su ficha, como candidatos de búsqueda. */
async function loadCandidates(): Promise<Candidate[]> {
  const now = Date.now();
  const snap = await adminDb.collection("artistProfiles").get();
  const out: Candidate[] = [];
  for (const doc of snap.docs) {
    const p = doc.data();
    if (!perfilVisible({ premium: p.premium ?? null, socio: p.socio }, now)) {
      continue;
    }
    const si = p.searchIndex as
      | {
          description?: string;
          appearance?: string;
          sound?: string;
          themes?: string;
          tags?: string[];
        }
      | undefined;
    const fichaParts = si
      ? [
          si.description,
          si.appearance,
          si.sound,
          si.themes,
          Array.isArray(si.tags) ? si.tags.join(", ") : "",
        ]
      : [];
    const slug = typeof p.slug === "string" ? p.slug : doc.id;
    const name = typeof p.artisticName === "string" ? p.artisticName : "";
    const genre = typeof p.genre === "string" ? p.genre : "";
    const city = typeof p.city === "string" ? p.city : "";
    out.push({
      slug,
      name,
      genre,
      city,
      disciplines: Array.isArray(p.disciplines) ? (p.disciplines as string[]) : [],
      haystack: normalizeText(
        [name, genre, city, ...fichaParts].filter(Boolean).join(" · "),
      ),
    });
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

function buildPrompt(query: string, candidates: Candidate[]): string {
  const list = candidates
    .map(
      (c, i) =>
        `${i + 1}. slug: ${c.slug}\n   nombre: ${c.name}\n   género: ${c.genre}\n   ciudad: ${c.city}\n   ficha: ${c.haystack || "(sin ficha)"}`,
    )
    .join("\n");
  return `Consulta del visitante: "${query}"

Candidatos:
${list}

Responde SOLO con un objeto JSON: {"slugs": ["slug-mas-relevante", "..."]}.`;
}

/** Extrae los slugs de la respuesta y los filtra a candidatos reales. */
function parseSlugs(raw: string, candidates: Candidate[]): string[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  let arr: unknown;
  try {
    const parsed = JSON.parse(text) as unknown;
    arr = Array.isArray(parsed)
      ? parsed
      : (parsed as { slugs?: unknown })?.slugs;
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const valid = new Set(candidates.map((c) => c.slug));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (typeof s === "string" && valid.has(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
      if (out.length >= MAX_RESULTS) break;
    }
  }
  return out;
}

/**
 * Respaldo sin IA (sin GEMINI_API_KEY o si el modelo falla): ranking por nº de
 * términos de la consulta presentes en la ficha/datos del candidato. Determinista.
 */
function keywordMatch(query: string, candidates: Candidate[]): string[] {
  const terms = normalizeText(query)
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (terms.length === 0) return [];
  return candidates
    .map((c) => ({
      slug: c.slug,
      score: terms.reduce((n, t) => n + (c.haystack.includes(t) ? 1 : 0), 0),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((c) => c.slug);
}

function json(payload: SearchResponse, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
