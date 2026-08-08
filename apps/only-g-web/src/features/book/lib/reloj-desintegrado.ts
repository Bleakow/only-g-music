/**
 * EL RELOJ DEL DESINTEGRADO — la aritmética que reparte el turno de cada
 * partícula y dice dónde está el frente.
 *
 * Vive aparte de los dos motores por dos motivos. El primero es que es
 * aritmética PURA: se comprueba sin navegador, y de ella depende una invariante
 * que falla CALLANDO — que al principio y al final del recorrido no quede ni una
 * partícula en el aire. Una con el turno fuera de 0..1 se queda flotando sobre
 * una foto que ya está entera, y no hay error que lo delate.
 *
 * El segundo es más prosaico: `desintegrar` (rejilla) y `ceniza` (capas de
 * píxeles) necesitan las mismas cuentas, y `desintegrar` importa a `ceniza` para
 * despacharle su receta. Con el reloj dentro de uno de los dos, los dos módulos
 * se importarían en círculo.
 */

/**
 * Ancho de la banda del frente, en fracción del recorrido: cuánto dura el vuelo
 * de un grano. Es también la fracción de granos que están en el aire a la vez, o
 * sea lo que de verdad cuesta cada fotograma.
 */
export const BANDA = 0.34;

/**
 * QUÉ PARTE DEL VUELO DE UN GRANO OCUPA LA DESAPARICIÓN DE SU TROZO DE FOTO.
 *
 * Piénsalo al revés, que es como se ve armándose: el grano viaja de fuera hacia
 * su casa. Si la foto se cierra durante el ÚLTIMO tramo de ese viaje —con el
 * grano todavía a media distancia— la foto termina ANTES de que la arena
 * aterrice. Puesta en el PRIMER tramo, al derecho la foto se va nada más
 * despegar el grano y al revés no acaba de cerrarse hasta que ya está en su
 * sitio. Y deja un margen a cada extremo en el que solo hay arena: la secuencia
 * empieza con polvo que se junta y termina con polvo que se va.
 */
export const FOTO_TRAS_POLVO = 0.5;

/**
 * CUÁNTO SE DESORDENA EL TURNO DE CADA GRANO respecto al de su sitio.
 *
 * Sin esto el frente es una LÍNEA RECTA: todos los granos de una misma diagonal
 * salen a la vez y llegan a la vez, y el rincón que va último queda como una cuña
 * perfectamente recortada — que no se lee como arena, se lee como algo a medio
 * cargar. Con el turno desordenado el sitio sigue mandando, pero los vecinos ya
 * no van a una.
 *
 * El reparto `sitio·(1-D) + D·azar` mantiene el turno dentro de 0..1 sin recortar
 * nada, y eso importa: un turno por encima de 1 dejaría granos flotando sobre una
 * foto que ya está entera, y no hay error que lo delate.
 */
export const DISPERSION = 0.3;

/**
 * Ruido determinista a partir de un entero. Con azar de verdad el desintegrado no
 * se podría rebobinar, y esta secuencia se recorre en los dos sentidos.
 */
export function ruido(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// El reloj del desintegrado
//
// Estas tres cuentas reparten el turno de cada grano y dicen dónde está el
// frente. Salen del lienzo a propósito: son aritmética pura, se comprueban sin
// navegador, y de ellas depende una invariante que falla CALLANDO — que al
// principio y al final del recorrido no quede ni un grano en el aire.
// ─────────────────────────────────────────────────────────────────────────────

/** Dónde está el frente para un progreso dado (`0` = foto entera, `1` = nada). */
export function frenteDePolvo(p: number): number {
  return p * (1 + BANDA) - BANDA;
}

/** El turno de un grano: su sitio sobre el eje del vuelo, desordenado. */
export function turnoDeGrano(sitio: number, azar: number): number {
  return sitio * (1 - DISPERSION) + DISPERSION * azar;
}

/** Su vuelo: `0` = en casa (es su píxel de la foto), `1` = ya no se ve. */
export function vueloDeGrano(frente: number, turno: number): number {
  return (frente + BANDA - turno) / BANDA;
}


export interface Polvo {
  /**
   * Pinta el estado. `0` = foto entera y quieta, `1` = ya no queda nada.
   *
   * `armando` elige CON QUÉ VUELO se pinta: la foto se posa de una manera y se
   * la lleva el viento de otra. Lo decide `armandoEn`, no este módulo: quien
   * llama sabe en qué punto de la secuencia va y aquí solo se dibuja.
   */
  pintar(progreso: number, armando: boolean): void;
  destruir(): void;
}

/** Hasta aquí la foto se está armando. */
const FIN_ARMADO = 0.46;
/**
 * Y de `FIN_ARMADO` hasta aquí NO PASA NADA: la foto está entera y quieta. Ese
 * silencio es lo único que la convierte en una foto que se mira en vez de en un
 * efecto que se ve pasar, y es el único tramo del recorrido que no se recorta.
 */
const FIN_QUIETO = 0.66;

/**
 * ¿Este punto del tramo pertenece a la LLEGADA o a la SALIDA?
 *
 * Va aparte de `fasePolvo` —que solo dice cuánto polvo hay— porque el punto medio
 * del recorrido tiene la misma cantidad de polvo yendo que viniendo, y sin
 * embargo hay que pintarlo con vuelos distintos.
 *
 * El corte cae dentro del tramo QUIETO, donde no hay ni un grano en el aire: así
 * el cambio de vuelo ocurre mientras no se ve nada moverse y no hay salto.
 */
export function armandoEn(t: number): boolean {
  return t < FIN_QUIETO;
}

/**
 * La forma del desintegrado a lo largo de su tramo: SE ARMA, se queda quieta, SE
 * DESHACE. Devuelve cuánto polvo hay (0 = foto entera).
 *
 * Va en UNA función pura y la mueve UNA sola tween, y esto no es estilo: con dos
 * tweens —una para armar y otra para deshacer— cada una se aparca en su valor de
 * inicio o de fin cuando el scroll está fuera de su tramo, y la de deshacer
 * estaría escribiendo "foto entera" durante toda la fase de armado.
 */
export function fasePolvo(t: number): number {
  // Los extremos se devuelven a mano y no salen de la cuenta: `1 - 0.66` no da
  // `0.34` en coma flotante, así que la división terminaba en 0.999… y el último
  // fotograma dejaba un rastro de foto que no se iba nunca.
  if (t <= 0 || t >= 1) return 1;
  if (t < FIN_ARMADO) return 1 - t / FIN_ARMADO;
  if (t < FIN_QUIETO) return 0;
  return Math.min(1, (t - FIN_QUIETO) / (1 - FIN_QUIETO));
}
