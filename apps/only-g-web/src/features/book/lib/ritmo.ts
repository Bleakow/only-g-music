import type { RitmoId } from "@only-g/shared-types/book";

/**
 * Los números del RITMO, sueltos de GSAP a propósito.
 *
 * Vivían dentro de `motion.ts`, que arrastra ScrollTrigger y SplitText. La
 * vitrina también necesita saber cuánto dura y con qué curva se mueve algo, y no
 * puede pagar los plugins de scroll para leer dos números — ni al revés: el
 * editor monta vitrinas sin coreografía de scroll ninguna.
 *
 * Módulo PURO: sin `gsap` y sin DOM. Los `ease` son cadenas que lee GSAP.
 */
export interface ParamsRitmo {
  /** Cuánto se retrasa la animación respecto al scroll. `false` = sin arrastre. */
  scrub: number | false;
  /** Recorrido del parallax, en píxeles. */
  recorrido: number;
  /** Escala inicial de las piezas a sangre. */
  escala: number;
  duracion: number;
  ease: string;
}

export const RITMOS: Record<RitmoId, ParamsRitmo> = {
  // Movimientos largos, arrastre alto: el scroll va por delante y la imagen lo
  // alcanza. Es lo que hace que un editorial se sienta caro.
  sereno: {
    scrub: 1.6,
    recorrido: 130,
    escala: 1.1,
    duracion: 1.25,
    ease: "power2.out",
  },
  dinamico: {
    scrub: 1,
    recorrido: 90,
    escala: 1.16,
    duracion: 0.9,
    ease: "power3.out",
  },
  // Sin arrastre y con recorridos cortos: las cosas aparecen puestas, no
  // llegando. Es la lectura brutalista, y es deliberadamente seca.
  brusco: {
    scrub: false,
    recorrido: 40,
    escala: 1.05,
    duracion: 0.35,
    ease: "power4.out",
  },
};

/** El ritmo de la atmósfera, o el de la casa si llega uno que no existe. */
export function paramsDeRitmo(ritmo: RitmoId): ParamsRitmo {
  return RITMOS[ritmo] ?? RITMOS.dinamico;
}
