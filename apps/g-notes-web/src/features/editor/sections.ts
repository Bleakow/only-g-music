// Estructura de canción. Las secciones se marcan como líneas `[Verso]`, `[Coro]`…
// (formato tipo notebook: ligero, editable como texto, sin bloques rígidos).

export const SECTIONS = [
  "Intro",
  "Verso",
  "Pre-coro",
  "Coro",
  "Puente",
  "Hook",
  "Outro",
] as const;

export type SectionKind = (typeof SECTIONS)[number];

/** Una línea que es SOLO un marcador de sección, p. ej. `[Coro]` o `[Verso 2]`. */
export const SECTION_RE = /^\s*\[[^\]]+\]\s*$/;

export function isSectionLine(text: string): boolean {
  return SECTION_RE.test(text);
}
