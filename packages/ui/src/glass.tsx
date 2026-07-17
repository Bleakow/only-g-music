/**
 * Base del lenguaje "Liquid Glass" (Tailwind). Una sola receta de superficie que
 * comparten botón, card y modal para que el cristal se vea idéntico en toda la
 * UI del ecosistema Only G. Compartido entre only-g-web y g-notes-web.
 */

/** Superficie de cristal (sin radio ni padding: los pone cada componente). */
export const glassSurface =
  "relative bg-white/[0.06] ring-1 ring-inset ring-white/30 shadow-[0_8px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur-md";

/** Variante ligera para piezas pequeñas o densas (iconos, filas, chips). */
export const glassSurfaceSoft =
  "relative bg-white/[0.04] ring-1 ring-inset ring-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-14px_26px_-14px_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md";

/** Variante para menús/modales flotantes: más transparente y con más frost. */
export const glassSurfaceMenu =
  "relative bg-white/[0.05] ring-1 ring-inset ring-white/25 shadow-[0_12px_44px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-md";

/** Reflejo diagonal del cristal. Hereda el radio del contenedor. */
export function GlassSheen() {
  return (
    <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-linear-to-br from-white/25 via-transparent to-white/5" />
  );
}
