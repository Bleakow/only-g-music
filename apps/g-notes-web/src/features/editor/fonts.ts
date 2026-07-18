// Fuentes de la letra. Solo tipografías de SISTEMA (cero descargas, cero riesgo
// de fallback silencioso) elegidas para sentirse premium. La "Editorial" es la
// principal; el resto son sabores. La elección se guarda por dispositivo.

export interface LyricFont {
  id: string;
  label: string;
  /** Descripción corta del carácter (para el selector). */
  hint: string;
  stack: string;
}

export const LYRIC_FONTS: LyricFont[] = [
  {
    id: "editorial",
    label: "Editorial",
    hint: "Serif cálida, de manuscrito",
    stack:
      '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  },
  {
    id: "clasica",
    label: "Clásica",
    hint: "Serif elegante, alto contraste",
    stack:
      '"Baskerville", "Baskerville Old Face", "Hoefler Text", Garamond, "Times New Roman", serif',
  },
  {
    id: "maquina",
    label: "Máquina",
    hint: "Monoespaciada, borrador crudo",
    stack:
      'ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", "Roboto Mono", Consolas, monospace',
  },
  {
    id: "moderna",
    label: "Moderna",
    hint: "Sans de marca, limpia",
    stack:
      '"OGM", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
];

export const DEFAULT_FONT = "editorial";

const KEY = "g-notes:lyric-font";

export function loadFont(): string {
  try {
    const id = localStorage.getItem(KEY);
    return id && LYRIC_FONTS.some((f) => f.id === id) ? id : DEFAULT_FONT;
  } catch {
    return DEFAULT_FONT;
  }
}

export function setFont(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* modo privado / cuota: se ignora */
  }
}

/** Stack CSS de una fuente por id (cae en la principal si no existe). */
export function fontStack(id: string): string {
  return (LYRIC_FONTS.find((f) => f.id === id) ?? LYRIC_FONTS[0]).stack;
}
