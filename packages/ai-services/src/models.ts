// Catálogo de modelos disponibles para el usuario. Extensible a otros proveedores
// (OpenAI, Anthropic) en el futuro: basta con añadir entradas con su `provider`.

export interface AiModel {
  /** Id que se envía al proveedor. */
  id: string;
  /** Etiqueta para el selector. */
  label: string;
  provider: "gemini";
}

/**
 * Modelos GRATIS de Gemini verificados como funcionales (probados en vivo contra
 * la API). Los `-latest` son alias que apuntan siempre al modelo vigente.
 */
export const AI_MODELS: AiModel[] = [
  {
    id: "gemini-flash-lite-latest",
    label: "Flash-Lite · rápido (gratis)",
    provider: "gemini",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash · más capaz (gratis)",
    provider: "gemini",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite (gratis)",
    provider: "gemini",
  },
  {
    id: "gemini-flash-latest",
    label: "Flash · equilibrado (más lento)",
    provider: "gemini",
  },
];

export const DEFAULT_MODEL = "gemini-flash-lite-latest";
