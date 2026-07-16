"use client";

import { useEffect, useState } from "react";
import { VinylLoader } from "./VinylLoader";
import { markIntroReady } from "./intro-ready";

// Mínimo en pantalla: da tiempo a ver la intro del vinilo (entrada + needle drop
// + arranque) sin que sea un flash. Ajustable a gusto.
const MIN_MS = 2000;
// Tope duro: nunca dejar el overlay más de esto aunque algo no resuelva.
const MAX_MS = 6000;
const FADE_MS = 550;

/**
 * Overlay de carga INICIAL (primera visita / recarga completa). Muestra el vinilo
 * mientras arranca la app y cargan las fuentes, con un mínimo de marca; luego se
 * desvanece y se desmonta. Vive en el layout → se monta UNA vez por carga completa
 * y NO reaparece en navegaciones cliente (de esas se encarga `loading.tsx`).
 */
export function InitialLoader() {
  const [visible, setVisible] = useState(true);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let cancelled = false;

    const dismiss = () => {
      if (cancelled) return;
      setVisible(false);
      // Avisa al Hero para que arranque sus entradas justo cuando el overlay
      // empieza a irse (si arrancan antes, se ejecutan tapadas y no se ven).
      markIntroReady();
      window.setTimeout(() => {
        if (!cancelled) setGone(true);
      }, FADE_MS);
    };

    // Listo cuando cargan las fuentes (evita reflow por font-swap), respetando el
    // mínimo de marca.
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    fonts.then(() => {
      const wait = Math.max(0, MIN_MS - (performance.now() - start));
      window.setTimeout(dismiss, wait);
    });

    // Fallback duro por si `fonts.ready` nunca resuelve.
    const hard = window.setTimeout(dismiss, MAX_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(hard);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-0 z-[300] transition-opacity ease-out ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <VinylLoader />
    </div>
  );
}
