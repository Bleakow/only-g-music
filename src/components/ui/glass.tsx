/**
 * Base del lenguaje "Liquid Glass" (hecho a mano, Tailwind). Una sola receta de
 * superficie que comparten botón, card y modal para que el cristal se vea
 * idéntico en toda la UI:
 *   - translúcido (bg-white muy bajo) + desenfoque que refracta el fondo
 *   - borde-luz interior (ring-inset) = el canto del vidrio
 *   - sombra de profundidad + highlight superior interno
 * `GlassSheen` añade el reflejo diagonal y el filo brillante; usa
 * `rounded-[inherit]` para adaptarse al radio del contenedor (pill, card, etc.).
 */

/** Clases de la superficie de cristal (sin radio ni padding: los pone cada componente). */
export const glassSurface =
  "relative bg-white/[0.06] ring-1 ring-inset ring-white/30 shadow-[0_8px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur-md";

/**
 * Variante LIGERA para piezas pequeñas o densas (iconos de redes, filas, chips).
 * Pensada para leerse como VIDRIO incluso sobre fondo oscuro (donde el blur no
 * tiene nada que refractar): relleno casi transparente (no chapa metálica) +
 * canto cristalino (ring + inset highlight brillante arriba) + RESPLANDOR
 * interno suave que sube del borde inferior (luz atrapada en el cristal) +
 * sombra exterior que lo despega del fondo.
 */
export const glassSurfaceSoft =
  "relative bg-white/[0.04] ring-1 ring-inset ring-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-14px_26px_-14px_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md";

/**
 * Reflejo diagonal del cristal. Hereda el radio del contenedor (`rounded-[inherit]`).
 * El canto/borde superior lo da el `inset` highlight de `glassSurface` (sigue la
 * curva) — NO una línea recta, que en círculos quedaba como una raya extraña.
 */
export function GlassSheen() {
  return (
    <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/25 via-transparent to-white/5" />
  );
}
