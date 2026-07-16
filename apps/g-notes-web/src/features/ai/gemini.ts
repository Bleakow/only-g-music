// Cliente REST mínimo de la API de Gemini (Google AI Studio). SOLO server-side:
// la key (GEMINI_API_KEY) nunca sale de aquí. Endpoint estable, sin SDK ni deps.
// Firebase = Google Cloud, así que Gemini encaja con el stack; el día de mañana,
// mismo proyecto + billing → Vertex (postpago) cambiando solo esta capa.

interface GeminiOptions {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature?: number;
  /** Pide al modelo salida JSON (para listas parseables). */
  json?: boolean;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export async function geminiGenerate(opts: GeminiOptions): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${opts.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ parts: [{ text: opts.prompt }] }],
      generationConfig: {
        maxOutputTokens: opts.maxOutputTokens,
        temperature: opts.temperature ?? 0.9,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`gemini ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
