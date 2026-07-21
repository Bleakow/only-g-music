import type {
  BioRequest,
  BioResponse,
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
  /**
   * Devuelve el ID token del usuario (o null si no hay sesión). Se envía como
   * `Authorization: Bearer <token>` y el servidor lo verifica antes de llamar al
   * modelo. Se inyecta desde la app: este paquete no sabe nada de Firebase.
   */
  getToken?: () => Promise<string | null>;
}

/**
 * Cliente delgado del servicio de IA. NUNCA lleva API keys: solo hace POST al
 * endpoint, que resuelve el servidor (route handler de g-notes-web hoy, el
 * servicio @only-g/ai-engine en el futuro).
 */
export function createAiClient(opts: AiClientOptions = {}) {
  const base = opts.baseUrl ?? "";
  const doFetch = opts.fetchImpl ?? fetch;

  async function headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = { "content-type": "application/json" };
    const token = opts.getToken ? await opts.getToken() : null;
    if (token) h.authorization = `Bearer ${token}`;
    return h;
  }

  return {
    async complete(
      req: CompletionRequest,
      signal?: AbortSignal,
    ): Promise<CompletionResponse> {
      const res = await doFetch(`${base}/api/ai/complete`, {
        method: "POST",
        headers: await headers(),
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
        headers: await headers(),
        body: JSON.stringify(req),
        signal,
      });
      if (!res.ok) throw new Error(`ai/tools ${res.status}`);
      return (await res.json()) as CreativeResponse;
    },

    async improveBio(
      req: BioRequest,
      signal?: AbortSignal,
    ): Promise<BioResponse> {
      const res = await doFetch(`${base}/api/ai/bio`, {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify(req),
        signal,
      });
      if (!res.ok) throw new Error(`ai/bio ${res.status}`);
      return (await res.json()) as BioResponse;
    },
  };
}

export type AiClient = ReturnType<typeof createAiClient>;
