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

/**
 * Info de cupo FREEMIUM que el servidor adjunta a las respuestas de IA. Deja al
 * cliente pintar "te quedan N" y empujar a la membresía al topar. Ausente en
 * respuestas de stub (sin API key) — el cupo solo cuenta llamadas reales.
 */
export interface AiQuotaInfo {
  /** Sugerencias gratis restantes hoy. `null`/ausente = sin límite (miembro). */
  remaining?: number | null;
  /** true si ESTA petición se bloqueó por el tope diario gratis (resultado vacío). */
  limited?: boolean;
}

export interface CompletionResponse extends AiQuotaInfo {
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

export interface CreativeResponse extends AiQuotaInfo {
  op: CreativeOp;
  /** Lista de opciones para mostrar en el panel. */
  suggestions: string[];
  source: "ai" | "stub";
}

/**
 * Petición de "mejorar biografía": el artista da un germen (una frase o su bio
 * actual) y el servidor devuelve versiones profesionales para elegir. El resto
 * de campos son contexto que afina el tono (no obligatorios).
 */
export interface BioRequest {
  /** Lo que escribió el artista: frase suelta o bio a pulir. */
  seed: string;
  /** Nombre artístico, para personalizar. */
  name?: string;
  /** Ciudad/origen. */
  city?: string;
  /** Géneros musicales, para el estilo. */
  genres?: string[];
  /** Año de inicio de trayectoria, para dar contexto de recorrido. */
  startYear?: number;
  /** Modelo elegido (si no, el default del servidor). */
  model?: string;
}

export interface BioResponse {
  /** Versiones propuestas de la biografía (el servidor apunta a 2). */
  variants: string[];
  source: "ai" | "stub";
}
