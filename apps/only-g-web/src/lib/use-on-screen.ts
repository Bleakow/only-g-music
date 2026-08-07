import { useEffect, useRef, useState } from "react";

/**
 * ¿El elemento referenciado está (al menos parcialmente) en el viewport?
 * Se usa para ocultar la barra flotante de "continuar" cuando el botón real del
 * final del formulario ya es visible (evita ver dos botones a la vez), y para
 * arrancar y parar los vídeos en bucle del book según entran y salen.
 *
 * `rootMargin` permite adelantarse al borde de la pantalla: el book lo usa para
 * empezar a traer un vídeo cuando aún falta media pantalla para verlo, de forma
 * que llegue reproduciéndose y no arrancando. Se reciben sueltos y no como un
 * objeto de opciones a propósito: un objeto literal cambia de identidad en cada
 * render y volvería a montar el observador sin parar.
 */
export function useOnScreen<T extends Element>({
  rootMargin,
  threshold,
}: {
  rootMargin?: string;
  threshold?: number;
} = {}) {
  const ref = useRef<T | null>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin, threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin, threshold]);

  return { ref, onScreen };
}
