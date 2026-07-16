// Contratos (tipos) del servicio de IA de G Notes. Puros, sin API keys ni SDK:
// tanto el cliente (browser) como el servidor (route handler / ai-engine) los comparten.

/** Petición de autocompletado inline (ghost-text tipo Copilot). */
export interface CompletionRequest {
  /** Texto de la canción hasta el cursor (contexto principal). */
  prefix: string;
  /** Texto tras el cursor, si lo hay. */
  suffix?: string;
  /** Género de la canción, para adaptar el estilo. */
  genre?: string;
  /** Métrica dominante detectada (sílabas por verso), para coherencia. */
  targetMeter?: number;
  /** Modelo elegido por el usuario (si no, el default del servidor). */
  model?: string;
}

export interface CompletionResponse {
  /** Continuación sugerida (texto plano, sin comillas). */
  suggestion: string;
  /** De dónde salió: modelo real o stub determinista (sin API key). */
  source: "ai" | "stub";
}

/** Operaciones del panel contextual (al seleccionar palabra/frase/verso). */
export type CreativeOp = "rimas" | "frases" | "metaforas" | "expandir";

export interface CreativeRequest {
  op: CreativeOp;
  /** La selección (palabra, frase o verso). */
  text: string;
  /** Contexto alrededor de la selección (opcional). */
  context?: string;
  genre?: string;
  /** Modelo elegido por el usuario (si no, el default del servidor). */
  model?: string;
}

export interface CreativeResponse {
  op: CreativeOp;
  /** Lista de opciones para mostrar en el panel. */
  suggestions: string[];
  source: "ai" | "stub";
}
