/**
 * Cliente REST mínimo de Gemini para las Functions — MULTIMODAL (texto + imagen +
 * audio). Server-side: la key nunca sale de aquí. Sin SDK, solo fetch (Node 22).
 *
 * Espeja el wrapper del web (apps/only-g-web/src/features/ai/gemini.ts) pero acepta
 * partes binarias inline, para que la Cloud Function de indexado le pase las fotos
 * y el audio de intro de un perfil y obtenga una ficha de búsqueda.
 */
import * as logger from "firebase-functions/logger";

/** Parte binaria inline (imagen/audio) para una petición multimodal. */
export interface InlinePart {
  mimeType: string;
  /** base64 SIN el prefijo `data:`. */
  data: string;
}

interface GenerateOpts {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  /** Imágenes/audio a adjuntar tras el prompt. */
  media?: InlinePart[];
  maxOutputTokens?: number;
  temperature?: number;
  /** Pide salida JSON parseable. */
  json?: boolean;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Genera texto (o JSON) a partir de un prompt + medios opcionales. Reintenta ante
 * la deriva de la API (400 sin thinking) y ante transitorios (429/503).
 */
export async function geminiGenerateMultimodal(
  opts: GenerateOpts,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${opts.apiKey}`;

  const parts: Record<string, unknown>[] = [{ text: opts.prompt }];
  for (const m of opts.media ?? []) {
    parts.push({ inlineData: { mimeType: m.mimeType, data: m.data } });
  }

  const buildBody = (thinking: Record<string, unknown>): string =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: opts.maxOutputTokens ?? 900,
        temperature: opts.temperature ?? 0.4,
        ...thinking,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    });
  const post = (body: string): Promise<Response> =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(60_000),
    });

  // Thinking al mínimo (rápido/barato). Si el modelo lo rechaza (400), reintenta sin él.
  let body = buildBody({ thinkingConfig: { thinkingLevel: "low" } });
  let res = await post(body);
  if (res.status === 400) {
    body = buildBody({});
    res = await post(body);
  }
  // Transitorio (rate-limit / sobrecarga): un reintento corto con el mismo cuerpo.
  if (res.status === 429 || res.status === 503) {
    await new Promise((r) => setTimeout(r, 500));
    res = await post(body);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`gemini ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const outParts = data.candidates?.[0]?.content?.parts ?? [];
  return outParts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

/**
 * Descarga un asset (imagen/audio) por URL y lo devuelve como parte inline base64,
 * o `null` si falla o excede el límite de tamaño. Best-effort: indexar nunca debe
 * tumbar el trigger que lo dispara.
 */
export async function fetchInlinePart(
  url: string | null | undefined,
  maxBytes = 7_000_000,
): Promise<InlinePart | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      logger.warn(`[index] asset ${res.status}: ${url.slice(0, 80)}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      logger.warn(`[index] asset demasiado grande (${buf.byteLength}B), se omite`);
      return null;
    }
    const mimeType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || guessMime(url);
    return { mimeType, data: buf.toString("base64") };
  } catch (e) {
    logger.warn("[index] fetch de asset falló", e);
    return null;
  }
}

/** MIME por extensión, cuando el servidor de Storage no lo declara. */
function guessMime(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".mp3")) return "audio/mpeg";
  if (clean.endsWith(".m4a") || clean.endsWith(".mp4")) return "audio/mp4";
  if (clean.endsWith(".wav")) return "audio/wav";
  if (clean.endsWith(".ogg") || clean.endsWith(".webm")) return "audio/ogg";
  return "image/jpeg";
}
