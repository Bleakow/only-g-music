"use client";

import type { CSSProperties } from "react";
import { areaDeRanura } from "@only-g/shared-types/gallery-layout";
import { escenaDef, type EscenaTipo } from "@only-g/shared-types/book";

/** Ancho al que se monta la escena por dentro: el umbral del container query. */
const ANCHO_REAL = 768;

/**
 * Miniatura de una escena para el selector del editor.
 *
 * NO es un dibujo: es la escena real, montada a `ANCHO_REAL` (donde se compone
 * en ancho, que es donde cada escena se distingue) y escalada a la caja pequeña.
 * Así no hay dos geometrías que mantener sincronizadas — cambiar el díptico
 * cambia también su miniatura, sin tocar nada más.
 *
 * ANIMADA (`animada`): cada miniatura repite en bucle el MOVIMIENTO
 * característico de su escena. Es lo que de verdad las distingue: en estático,
 * un díptico y un retrato son dos rectángulos, y nadie elige entre dos
 * rectángulos con conocimiento de causa.
 *
 * Las animaciones son EVOCATIVAS, no literales: a 112 px de ancho, una
 * traslación exacta entre dos ranuras de la vitrina sería un borrón de veinte
 * píxeles. Lo que tiene que quedar claro es "aquí las fotos se cambian de
 * sitio", no cuántos píxeles recorren.
 *
 * Y son CSS, no GSAP: ocho timelines para un selector es absurdo, y el editor no
 * tiene por qué descargar el motor de scroll para enseñar ocho cuadraditos.
 */
export function BookSceneThumb({
  tipo,
  /** Ancho de la caja en píxeles. Manda la escala del contenido de dentro. */
  ancho = 112,
  /** Reproduce en bucle el movimiento de la escena. */
  animada = false,
}: {
  tipo: EscenaTipo;
  ancho?: number;
  animada?: boolean;
}) {
  const def = escenaDef(tipo);
  if (!def) return null;

  // Con el mínimo se ve la composición sin huecos: es lo que la escena promete.
  const piezas = Math.max(def.min, 1);

  return (
    <div
      className="og-book-thumb"
      data-anim={animada ? "si" : undefined}
      aria-hidden="true"
      style={
        {
          width: ancho,
          "--bk-thumb-escala": ancho / ANCHO_REAL,
        } as CSSProperties
      }
    >
      <div className="og-book-escena">
        <div className="og-book-grid" data-escena={tipo} data-piezas={piezas}>
          {Array.from({ length: piezas }, (_, i) => (
            <div
              key={i}
              className="og-book-celda"
              // La ranura es el asa de la animación: cada celda entra en su
              // momento en vez de moverse el bloque entero a la vez.
              data-ranura={i}
              style={{ gridArea: areaDeRanura(i) }}
            />
          ))}
          {(def.maxNotas > 0 || def.notaEnRejilla) && (
            <div className="og-book-celda" data-texto style={{ gridArea: "n" }} />
          )}
          {def.textoEnRejilla && (
            <div className="og-book-celda" data-texto style={{ gridArea: "h" }} />
          )}
        </div>
      </div>
    </div>
  );
}
