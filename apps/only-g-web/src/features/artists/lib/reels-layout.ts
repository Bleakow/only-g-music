/**
 * Reparto de la CUADRÍCULA DE REELS (solo escritorio).
 *
 * El problema es de escritorio y solo de escritorio: en el móvil un reel a ancho
 * completo es su formato nativo y se ve mejor que cualquier reproductor
 * horizontal, así que ahí no se toca nada. En una pantalla ancha, en cambio, ese
 * mismo 9:16 puesto en el centro o queda gigantesco o queda flotando en la nada.
 *
 * La cuadrícula lo arregla con dos reglas: las columnas las decide LA CANTIDAD
 * (nunca hay huecos de relleno), y las piezas van acotadas de ancho y centradas
 * (uno se lee como un póster; cuatro, como una tira).
 *
 * Módulo PURO: la clase de Tailwind la elige el componente.
 */

/** Máximo de reels que compone la cuadrícula (coincide con `featuredMediaPolicy`). */
export const MAX_REELS = 4;

/**
 * Ancho máximo de cada pieza, en píxeles. Es lo que impide que UN solo reel se
 * estire a lo ancho de un monitor: a 9:16, 260px de ancho son ~460 de alto, que
 * es un póster que se mira entero sin hacer scroll.
 */
export const REEL_ANCHO_MAX = 260;

/**
 * Columnas de la cuadrícula para `n` reels. Siempre `n`: con un máximo de cuatro
 * caben todas en una fila, y una sola fila centrada es lo que hace que dos reels
 * no parezcan una rejilla de cuatro a la que le faltan dos.
 *
 * Se acota igualmente a [1, MAX_REELS]: la política limita la subida, pero un
 * perfil antiguo podría traer más de los que hoy se admiten.
 */
export function columnasDeReels(n: number): number {
  return Math.max(1, Math.min(n, MAX_REELS));
}
