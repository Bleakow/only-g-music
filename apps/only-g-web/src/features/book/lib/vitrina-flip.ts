import gsap from "gsap";
import { Flip } from "gsap/Flip";
import type { RitmoId } from "@only-g/shared-types/book";
import { paramsDeRitmo } from "./ritmo";

/**
 * EL INTERCAMBIO DE LA VITRINA — la traslación entre la foto grande y una
 * miniatura.
 *
 * Módulo aparte y cargado con `import()` desde la escena. No es tacañería de
 * bytes: es que el intercambio TIENE que funcionar aunque este archivo no llegue
 * nunca. Quien pide menos movimiento no lo descarga; quien toca una miniatura
 * mientras aún viaja por la red ve el cambio seco. En los dos casos la vitrina
 * hace lo que promete — lo único que falta es el viaje.
 */

gsap.registerPlugin(Flip);

/**
 * `ReturnType` y no `Flip.FlipState`: al importar la clase, el nombre `Flip`
 * queda tapado en este módulo y el espacio de nombres con sus tipos deja de
 * verse. Esto resuelve al mismo tipo sin depender de ese detalle.
 */
export type EstadoVitrina = ReturnType<typeof Flip.getState>;

/**
 * Fotografía la geometría de las figuras ANTES de que React cambie nada.
 *
 * `props: "borderRadius"` no es decoración: Flip solo interpola las propiedades
 * que le nombras, y el redondeo forma parte del cambio de sitio (la principal lo
 * tiene mayor que las miniaturas). Sin esto saltaría de golpe en el primer
 * fotograma del vuelo.
 */
export function capturar(figuras: Element[]): EstadoVitrina {
  return Flip.getState(figuras, { props: "borderRadius" });
}

/** Anima de la geometría capturada a la que ya tiene el DOM. */
export function animar(estado: EstadoVitrina, ritmo: RitmoId): gsap.core.Timeline {
  const p = paramsDeRitmo(ritmo);

  return Flip.from(estado, {
    // Tope de 0.85 s: con el ritmo `sereno` la duración de las entradas de
    // scroll (1.25 s) es correcta porque el scroll va por delante; una RESPUESTA
    // a un toque que tarda más de un segundo se siente rota.
    duration: Math.min(p.duracion, 0.85),
    ease: p.ease,
    /**
     * Sin `absolute`, Flip anima el ancho y el alto de unas celdas que siguen
     * dentro de la rejilla: cada fotograma re-mide las pistas y la escena entera
     * tiembla. Sacándolas del flujo, la rejilla se queda quieta — y por eso sus
     * filas están declaradas en `cqw`/`calc()` y NUNCA en `auto`: una rejilla de
     * filas automáticas sin contenido en flujo se desploma a cero.
     */
    absolute: true,
    /**
     * Explícito porque importa: la principal es vertical y las miniaturas casi
     * cuadradas. Escalando con `transform` se aplastaría la cara de la modelo
     * durante todo el viaje. Anima ancho y alto, que cuesta más — pero son cinco
     * elementos y menos de un segundo.
     */
    scale: false,
    nested: true,
  });
}
