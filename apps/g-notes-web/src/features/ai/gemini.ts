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
  const buildBody = (thinking: Record<string, unknown>): string =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ parts: [{ text: opts.prompt }] }],
      generationConfig: {
        maxOutputTokens: opts.maxOutputTokens,
        temperature: opts.temperature ?? 0.9,
        ...thinking,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    });
  const post = (body: string): Promise<Response> =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

  // Thinking al MÍNIMO: para autocompletado/panel queremos respuesta directa,
  // rápida y barata. Gemini 3.x (a donde hoy apunta el alias `-latest`) lo
  // controla con `thinkingLevel` ("low" = el mínimo); YA NO acepta el antiguo
  // `thinkingBudget: 0`, que devuelve 400 "invalid argument".
  let body = buildBody({ thinkingConfig: { thinkingLevel: "low" } });
  let res = await post(body);

  // Resiliencia ante la DERIVA de la API de Gemini: si el modelo rechaza el
  // control de thinking (400), se reintenta SIN él (formato universal). Así un
  // futuro repunteo del alias `-latest` a otro modelo no vuelve a tumbar la IA.
  if (res.status === 400) {
    body = buildBody({});
    res = await post(body);
  }

  // Transitorio (429 rate-limit / 503 modelo sobrecargado): un reintento corto
  // con el MISMO cuerpo. Gemini en capa gratis se satura a ratos; sin esto, un
  // pico de carga hace caer el autocompletado al stub (mock data).
  if (res.status === 429 || res.status === 503) {
    await new Promise((r) => setTimeout(r, 400));
    res = await post(body);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`gemini ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as GeminiResponse;
  // Une TODAS las partes de texto: los modelos "thinking" (Gemini 3) pueden
  // devolver el texto en una parte posterior, no en parts[0].
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}
