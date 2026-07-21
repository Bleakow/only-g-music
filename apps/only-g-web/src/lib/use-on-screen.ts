import { useEffect, useRef, useState } from "react";

/**
 * ¿El elemento referenciado está (al menos parcialmente) en el viewport?
 * Se usa para ocultar la barra flotante de "continuar" cuando el botón real del
 * final del formulario ya es visible (evita ver dos botones a la vez).
 */
export function useOnScreen<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) =>
      setOnScreen(entry.isIntersecting),
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, onScreen };
}
