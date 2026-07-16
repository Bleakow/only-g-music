import type {
  CompletionRequest,
  CompletionResponse,
  CreativeRequest,
  CreativeResponse,
} from "./contracts";

export interface AiClientOptions {
  /** Base URL del servicio (vacío = mismo origen; el default en el browser). */
  baseUrl?: string;
  /** Inyectable para tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Cliente delgado del servicio de IA. NUNCA lleva API keys: solo hace POST al
 * endpoint, que resuelve el servidor (route handler de g-notes-web hoy, el
 * servicio @only-g/ai-engine en el futuro).
 */
export function createAiClient(opts: AiClientOptions = {}) {
  const base = opts.baseUrl ?? "";
  const doFetch = opts.fetchImpl ?? fetch;

  return {
    async complete(
      req: CompletionRequest,
      signal?: AbortSignal,
    ): Promise<CompletionResponse> {
      const res = await doFetch(`${base}/api/ai/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
        signal,
      });
      if (!res.ok) throw new Error(`ai/complete ${res.status}`);
      return (await res.json()) as CompletionResponse;
    },

    async creative(
      req: CreativeRequest,
      signal?: AbortSignal,
    ): Promise<CreativeResponse> {
      const res = await doFetch(`${base}/api/ai/tools`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
        signal,
      });
      if (!res.ok) throw new Error(`ai/tools ${res.status}`);
      return (await res.json()) as CreativeResponse;
    },
  };
}

export type AiClient = ReturnType<typeof createAiClient>;
