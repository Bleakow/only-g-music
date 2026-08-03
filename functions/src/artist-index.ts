/**
 * Indexado de perfiles para la BÚSQUEDA IA del directorio (§03). A partir de las
 * fotos, el audio de intro y el texto de un perfil, Gemini multimodal produce una
 * "ficha" (`ProfileSearchIndex`) buscable en lenguaje natural. Las Cloud Functions
 * (trigger onWrite + backfill) viven en index.ts y usan estos helpers.
 *
 * SOLO importa TIPOS de shared-types (functions se compila sin bundler; un import
 * de valor haría `require` de un .ts en runtime). Por eso `sourcesOf`/`needsReindex`
 * se reimplementan aquí INLINE, en sync con packages/shared-types/src/artist-profile.ts.
 */
import * as logger from "firebase-functions/logger";
import type {
  ProfileSearchIndex,
  ProfileIndexSources,
} from "@only-g/shared-types/artist-profile";
import {
  geminiGenerateMultimodal,
  fetchInlinePart,
  type InlinePart,
} from "./gemini";

/** Modelo multimodal (imagen + audio). Free tier por ahora; override por env. */
const MODEL = process.env.ONLYG_GEMINI_INDEX_MODEL || "gemini-flash-latest";

const SYSTEM = `Eres el indexador de un directorio profesional de artistas y talento (contexto de casting y booking). A partir de las FOTOS, el AUDIO y el TEXTO de un perfil, produces una ficha de búsqueda FACTUAL y objetiva que permita encontrar a la persona por rasgos concretos.
Describe SOLO lo observable, útil para casting:
- Apariencia (de las fotos): color y largo de cabello, color de ojos, complexión y estatura aparente, vello facial, presentación/estilo, rango de edad aparente. Describe tono de piel de forma neutral y factual; NO afirmes etnia, nacionalidad ni origen: eso no se deduce de una foto.
- Sonido/voz: si hay AUDIO, describe tipo de voz, timbre, técnica y energía. Si NO hay audio, dedúcelo con cautela del género y el texto, y dilo como tendencia, no como hecho.
- Temática: de qué trata su música/trabajo, a partir del texto.
Sin juicios de valor ni adjetivos publicitarios. Responde SIEMPRE en español.`;

interface Facts {
  name: string;
  tagline: string;
  genre: string;
  genres: string[];
  bio: string;
  trackTitles: string[];
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function strArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
    : [];
}

function factsOf(p: Record<string, unknown>): Facts {
  return {
    name: str(p.artisticName),
    tagline: str(p.tagline),
    genre: str(p.genre),
    genres: strArray(p.genres),
    bio: str(p.bio),
    trackTitles: Array.isArray(p.tracks)
      ? (p.tracks as unknown[])
          .map((t) => str((t as { title?: unknown })?.title))
          .filter(Boolean)
      : [],
  };
}

function buildPrompt(f: Facts, hasAudio: boolean): string {
  const lines: string[] = [];
  if (f.name) lines.push(`Nombre artístico: ${f.name}`);
  if (f.tagline) lines.push(`Frase: ${f.tagline}`);
  const gs = f.genres.length ? f.genres.join(", ") : f.genre;
  if (gs) lines.push(`Género(s): ${gs}`);
  if (f.trackTitles.length) lines.push(`Temas: ${f.trackTitles.join(", ")}`);
  if (f.bio) lines.push(`Bio: ${f.bio}`);
  const audioNote = hasAudio
    ? "Se adjunta un CLIP DE AUDIO del artista: úsalo para el campo 'sound'."
    : "NO hay audio: infiere 'sound' con cautela del género/texto.";

  return `Analiza las imágenes adjuntas (retratos del artista) y, si lo hay, el audio. ${audioNote}

Datos del perfil:
${lines.join("\n") || "(sin texto)"}

Devuelve SOLO un objeto JSON con esta forma exacta:
{
  "description": "un párrafo (40-80 palabras) que FUSIONE apariencia + voz/estilo + temática, redactado para búsqueda semántica",
  "tags": ["etiquetas cortas: p. ej. 'cabello negro', 'ojos marrones', 'complexión atlética', 'voz aguda', 'afrobeat'"],
  "appearance": "solo apariencia física observable",
  "sound": "solo voz/estilo musical",
  "themes": "solo de qué trata su música"
}`;
}

/** Parseo defensivo de la respuesta JSON del modelo. `null` si no es usable. */
function parseIndex(
  raw: string,
): Pick<
  ProfileSearchIndex,
  "description" | "tags" | "appearance" | "sound" | "themes"
> | null {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  const description = str(obj.description);
  if (!description) return null;
  return {
    description,
    tags: strArray(obj.tags).slice(0, 24),
    appearance: str(obj.appearance) || undefined,
    sound: str(obj.sound) || undefined,
    themes: str(obj.themes) || undefined,
  };
}

/** Hash corto y estable (djb2) — sync con textSignature de shared-types. */
function textSignature(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Firma de las fuentes indexables — sync con searchSources de shared-types. */
export function sourcesOf(p: Record<string, unknown>): ProfileIndexSources {
  const f = factsOf(p);
  const text = [f.tagline, f.genre, ...f.genres, f.bio, ...f.trackTitles]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" | ");
  return {
    photo: str(p.photoURL) || undefined,
    audio: str(p.entryTrackUrl) || undefined,
    text: textSignature(text),
  };
}

/** ¿Cambiaron las fuentes desde el último indexado? — sync con needsReindex. */
export function needsReindex(p: Record<string, unknown>): boolean {
  const prev = (p.searchIndex as ProfileSearchIndex | undefined)?.sources;
  if (!prev) return true;
  const cur = sourcesOf(p);
  return (
    cur.photo !== prev.photo ||
    cur.audio !== prev.audio ||
    cur.text !== prev.text
  );
}

/** Cota de medios: foto principal + hasta 2 de galería + audio, con techo total. */
async function gatherMedia(p: Record<string, unknown>): Promise<{
  media: InlinePart[];
  hasAudio: boolean;
}> {
  const media: InlinePart[] = [];
  let total = 0;
  const TOTAL_CAP = 14_000_000;

  const add = async (url: string, cap: number): Promise<boolean> => {
    if (!url || total >= TOTAL_CAP) return false;
    const part = await fetchInlinePart(url, cap);
    if (!part) return false;
    total += Math.ceil((part.data.length * 3) / 4); // bytes aprox desde base64
    media.push(part);
    return true;
  };

  await add(str(p.photoURL), 6_000_000);
  const gallery = Array.isArray(p.gallery) ? (p.gallery as unknown[]) : [];
  for (const g of gallery.slice(0, 2)) {
    await add(str((g as { url?: unknown })?.url), 4_000_000);
  }
  const hasAudio = await add(str(p.entryTrackUrl), 6_000_000);
  return { media, hasAudio };
}

/**
 * Construye la ficha de búsqueda de un perfil. Devuelve `null` si no hay medios ni
 * texto que valgan o si el modelo no devolvió algo usable (el trigger deja el
 * perfil sin `searchIndex` y reintentará en la próxima escritura).
 */
export async function buildSearchIndex(
  p: Record<string, unknown>,
  apiKey: string,
): Promise<ProfileSearchIndex | null> {
  const { media, hasAudio } = await gatherMedia(p);
  const facts = factsOf(p);
  // Sin ninguna señal (ni foto ni texto), no hay nada que indexar.
  if (media.length === 0 && !facts.bio && !facts.genre && !facts.name) {
    return null;
  }

  const raw = await geminiGenerateMultimodal({
    apiKey,
    model: MODEL,
    system: SYSTEM,
    prompt: buildPrompt(facts, hasAudio),
    media,
    json: true,
    maxOutputTokens: 900,
    temperature: 0.4,
  });

  const parsed = parseIndex(raw);
  if (!parsed) {
    logger.warn("[index] respuesta de Gemini no parseable");
    return null;
  }
  return {
    ...parsed,
    sources: sourcesOf(p),
    indexedAt: Date.now(),
    model: MODEL,
  };
}
