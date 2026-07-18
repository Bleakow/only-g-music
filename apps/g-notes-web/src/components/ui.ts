// Estilo de trigger compacto para SearchableSelect en las toolbars densas de
// G Notes (evita la altura de campo de formulario de 44px del default de
// @only-g/ui, pensado para formularios). Reutilizado por la barra de metadata,
// el selector de modelo y el diálogo de release.
export const COMPACT_SELECT =
  "flex min-h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-silver-200/10 bg-white/[0.03] px-2.5 py-1 text-left text-xs text-silver-200 outline-none transition hover:border-silver-200/25 focus-visible:ring-2 focus-visible:ring-amethyst-300/70";

// Chip ligero para la tira de metadatos: pill de texto tenue, borde finísimo,
// sin peso de campo de formulario. Es el trigger de un SearchableSelect.
export const CHIP_SELECT =
  "flex min-h-7 w-full items-center justify-between gap-1.5 rounded-full border border-silver-200/10 bg-transparent px-3 py-1 text-left text-xs text-silver-300 outline-none transition hover:border-silver-200/25 hover:text-silver-100 focus-visible:ring-2 focus-visible:ring-amethyst-300/60";

// Chip-botón (no-select): mismo lenguaje visual para acciones tipo estado o «···».
export const CHIP_BTN =
  "inline-flex min-h-7 items-center gap-1.5 rounded-full border border-silver-200/10 px-3 py-1 text-xs text-silver-300 outline-none transition hover:border-silver-200/25 hover:text-silver-100 focus-visible:ring-2 focus-visible:ring-amethyst-300/60";
