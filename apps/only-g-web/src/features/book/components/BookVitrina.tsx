"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { areaDeRanura } from "@only-g/shared-types/gallery-layout";
import {
  ranurasDeVitrina,
  traerAlFrente,
  type EscenaBook,
  type RitmoId,
} from "@only-g/shared-types/book";
import { BookPiece } from "./BookPiece";
import type { EstadoVitrina } from "../lib/vitrina-flip";

/**
 * LA VITRINA: una foto grande con su cita y 2-4 miniaturas al lado. Al tocar una
 * miniatura, esa foto y la grande SE CAMBIAN EL SITIO con una traslación.
 *
 * El estado NO es un reordenar de `escena.piezas` sino un REPARTO de ranuras
 * (`ranurasDeVitrina`). Dos motivos, ninguno estético:
 *  1. `escena.piezas` es el dato que guardó la modelo — si mirar el book lo
 *     reordenara, mirar sería editar.
 *  2. Si el array cambiara de orden, React movería los nodos del DOM, y mover
 *     nodos rompe a la vez el foco del teclado y la identidad que necesita la
 *     animación: el elemento que se mide ANTES tiene que ser el MISMO que se
 *     anima después. Aquí lo único que cambia es el `grid-area` de cada figura.
 *
 * La coordinación con React es la parte delicada. Se captura la geometría en el
 * MANEJADOR del clic —entre el clic y el commit no cabe ni un scroll— y se anima
 * en un `useLayoutEffect`, que corre tras la mutación del DOM y ANTES del
 * pintado. Con `useEffect` se vería el salto y luego la animación; capturando
 * dentro del efecto se mediría el DOM ya movido y no habría nada que interpolar.
 */
export function BookVitrina({
  escena,
  nombre,
  ritmo,
}: {
  escena: EscenaBook;
  nombre: string;
  ritmo: RitmoId;
}) {
  const t = useTranslations("book");
  const raiz = useRef<HTMLDivElement>(null);
  const capturado = useRef<EstadoVitrina | null>(null);
  const [ranuras, setRanuras] = useState(() =>
    ranurasDeVitrina(escena.piezas.length),
  );

  // Si la modelo añade o quita fotos en el editor, el reparto se rehace.
  const esperado = escena.piezas.length;
  if (ranuras.length !== esperado) {
    setRanuras(ranurasDeVitrina(esperado));
  }

  useLayoutEffect(() => {
    const estado = capturado.current;
    if (!estado) return;
    capturado.current = null;

    let tl: { kill: () => void } | null = null;
    let cancelado = false;
    // El módulo de la animación se carga aparte: si no llega, el intercambio ya
    // ocurrió — solo falta el viaje.
    import("../lib/vitrina-flip")
      .then(({ animar }) => {
        if (cancelado) return;
        tl = animar(estado, ritmo);
      })
      .catch(() => {});

    return () => {
      cancelado = true;
      tl?.kill(); // StrictMode monta dos veces
    };
  }, [ranuras, ritmo]);

  async function seleccionar(pieza: number) {
    const el = raiz.current;
    if (!el) return;
    const siguiente = traerAlFrente(ranuras, pieza);
    // Misma referencia = ya estaba delante. Ni se captura ni se re-renderiza.
    if (siguiente === ranuras) return;

    try {
      const { capturar } = await import("../lib/vitrina-flip");
      capturado.current = capturar(
        Array.from(el.querySelectorAll(".og-book-vit-figura")),
      );
    } catch {
      /* sin animación: el cambio será seco, que sigue siendo el cambio */
    }
    setRanuras(siguiente);
  }

  const alFrente = escena.piezas[ranuras[0]];

  return (
    <div
      ref={raiz}
      className="og-book-grid"
      data-escena="vitrina"
      data-piezas={escena.piezas.length}
      data-medida="amplia"
    >
      {escena.encabezado && (
        <h2
          className="og-book-display og-book-vit-titulo"
          style={{ gridArea: "h" }}
        >
          {escena.encabezado}
        </h2>
      )}

      {ranuras.map((pieza, ranura) => {
        const p = escena.piezas[pieza];
        if (!p) return null;
        const principal = ranura === 0;
        return (
          <figure
            // La clave es la PIEZA, no la ranura: así React conserva el mismo
            // nodo cuando cambia de sitio, que es lo que necesita la traslación
            // para saber qué está moviendo.
            key={`${escena.id}-${pieza}`}
            className="og-book-figura og-book-vit-figura"
            data-vit={principal ? "principal" : "miniatura"}
            style={{ gridArea: areaDeRanura(ranura) }}
          >
            <BookPiece
              pieza={p}
              alt={p.titulo || nombre}
              // La principal ocupa media escena y las miniaturas un cuarto:
              // servirles la misma foto multiplica por cuatro los bytes justo
              // en la escena que más se mira.
              sizes={
                principal
                  ? "(max-width: 48rem) 100vw, 42vw"
                  : "(max-width: 48rem) 33vw, 22vw"
              }
              usarRatio={false}
            />
            <button
              type="button"
              className="og-book-vit-boton"
              onClick={() => void seleccionar(pieza)}
              disabled={principal}
              aria-pressed={principal}
              aria-label={t("vitrinaVer", { n: pieza + 1 })}
            />
          </figure>
        );
      })}

      {(alFrente?.nota || alFrente?.titulo) && (
        <figcaption className="og-book-vit-cita" style={{ gridArea: "n" }}>
          {alFrente.nota && (
            <blockquote className="og-book-vit-frase">{alFrente.nota}</blockquote>
          )}
          {alFrente.titulo && (
            <p className="og-book-vit-firma">
              <cite>{alFrente.titulo}</cite>
            </p>
          )}
        </figcaption>
      )}
    </div>
  );
}
