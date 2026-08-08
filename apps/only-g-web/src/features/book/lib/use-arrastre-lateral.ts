"use client";

import { useEffect, useRef } from "react";

/**
 * ARRASTRAR PARA RECORRER una fila que se desborda de lado.
 *
 * En el móvil esto ya funciona: el dedo arrastra el scroll nativo, con su
 * inercia y su imán. En escritorio no había gesto — solo la rueda con `shift` o
 * una barra que el CSS esconde— y por eso la serie se sentía torpe. Ahora se
 * agarra y se tira, que es lo que la mano intenta.
 *
 * SOLO CON PUNTERO FINO. En táctil el navegador ya hace esto mejor de lo que se
 * puede escribir aquí: capturar el gesto le quitaría al visitante la inercia, el
 * rebote y el imán, que son cosas del sistema y no se imitan con dos restas.
 *
 * TRES DETALLES QUE PARECEN DE ADORNO Y NO LO SON:
 *
 *  1. El IMÁN se apaga mientras se arrastra. `scroll-snap-type: mandatory` pelea
 *     con cada asignación a `scrollLeft`: el navegador tira hacia la foto más
 *     cercana mientras la mano tira hacia el otro lado, y el resultado es una
 *     fila que se resiste.
 *  2. El CLIC QUE SIGUE AL ARRASTRE se traga, y en fase de CAPTURA para llegar
 *     antes que el botón de la foto. Sin esto, soltar después de recorrer la
 *     fila abre la foto a pantalla completa — que es exactamente lo que no
 *     estabas pidiendo.
 *  3. `setPointerCapture`, para que soltar fuera de la fila —o fuera de la
 *     ventana— cuente igual. Sin captura, el ratón se suelta en otro sitio y la
 *     fila se queda pegada al cursor para siempre.
 */
export function useArrastreLateral<T extends HTMLElement>(activo: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !activo) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let agarrado = false;
    let movido = false;
    let x0 = 0;
    let scroll0 = 0;

    const abajo = (e: PointerEvent) => {
      if (e.button !== 0) return;
      agarrado = true;
      movido = false;
      x0 = e.clientX;
      scroll0 = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      el.dataset.agarrando = "si";
    };

    const mover = (e: PointerEvent) => {
      if (!agarrado) return;
      const d = e.clientX - x0;
      // Cuatro píxeles de holgura: sin ellos, el temblor de un clic normal
      // contaría como arrastre y la foto no se abriría nunca.
      if (Math.abs(d) > 4) movido = true;
      el.scrollLeft = scroll0 - d;
    };

    const soltar = (e: PointerEvent) => {
      if (!agarrado) return;
      agarrado = false;
      delete el.dataset.agarrando;
      // Puede haberse perdido ya (el puntero salió de la ventana): no es un error.
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    const clic = (e: MouseEvent) => {
      if (!movido) return;
      movido = false;
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener("pointerdown", abajo);
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);
    el.addEventListener("click", clic, true);

    return () => {
      el.removeEventListener("pointerdown", abajo);
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerup", soltar);
      el.removeEventListener("pointercancel", soltar);
      el.removeEventListener("click", clic, true);
      delete el.dataset.agarrando;
    };
  }, [activo]);

  return ref;
}
