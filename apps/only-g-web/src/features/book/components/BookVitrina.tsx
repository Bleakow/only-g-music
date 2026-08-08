"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ranurasDeVitrina,
  sitioDeRanura,
  traerAlFrente,
  type EscenaBook,
} from "@only-g/shared-types/book";
import { BookPiece } from "./BookPiece";
import { useVistaAmplia } from "./BookVistaAmplia";

/**
 * LA VITRINA: tres fotos con su descripción. Una siempre AL FRENTE y las otras
 * dos regadas a los lados, inclinadas y más pequeñas. Al tocar una de atrás, la
 * del frente sale disparada hacia un lado encogiéndose por el camino y le deja
 * el sitio; las tres se mueven, una tras otra.
 *
 * EL MISMO BOTÓN HACE DOS COSAS SEGÚN DÓNDE ESTÉ LA CARTA, y es lo que hace que
 * no haga falta explicar nada: si está detrás, tocarla la trae al frente; si ya
 * está al frente, tocarla la abre a pantalla completa. Un segundo botón encima
 * de la foto para ampliarla habría tapado justo lo que se quiere mirar.
 *
 * EL ESTADO NO ES UN REORDENAR sino un REPARTO DE SITIOS (`ranurasDeVitrina`).
 * Dos motivos, ninguno estético:
 *  1. `escena.piezas` es el dato que guardó la modelo. Si mirar el book lo
 *     reordenara, mirar sería editar.
 *  2. Si el array cambiara de orden, React movería los nodos del DOM — y mover
 *     un nodo cancela su transición a medias y le roba el foco al teclado. Aquí
 *     cada carta se queda en su sitio del DOM y lo único que cambia es su
 *     `data-slot`; de interpolar entre un sitio y otro se encarga el CSS.
 *
 * Por eso este componente no tiene ni una línea de animación: toda la
 * coreografía vive en `book.css`. Es lo que la hace reversible (tocar dos veces
 * deja todo donde estaba) y a prueba de que el motor de scroll no llegue.
 */
export function BookVitrina({
  escena,
  nombre,
}: {
  escena: EscenaBook;
  nombre: string;
}) {
  const t = useTranslations("book");
  // `null` fuera del book (el editor monta la vitrina como una fila de huecos):
  // allí la carta del frente se queda sin ampliar, que es lo correcto.
  const ampliar = useVistaAmplia();
  const [ranuras, setRanuras] = useState(() =>
    ranurasDeVitrina(escena.piezas.length),
  );

  // Si la modelo añade o quita fotos en el editor, el reparto se rehace.
  if (ranuras.length !== escena.piezas.length) {
    setRanuras(ranurasDeVitrina(escena.piezas.length));
  }

  const alFrente = escena.piezas[ranuras[0]];

  return (
    <div
      className="og-book-grid"
      data-escena="vitrina"
      data-medida="amplia"
      data-piezas={escena.piezas.length}
    >
      {escena.encabezado && (
        <h2 className="og-book-display og-book-vit-titulo">
          {escena.encabezado}
        </h2>
      )}

      <div className="og-book-vit-escenario">
        {escena.piezas.map((pieza, i) => {
          // Dónde está ESTA pieza ahora mismo. El índice del array es su sitio
          // en el DOM y no cambia nunca; lo que cambia es en qué ranura está.
          const ranura = ranuras.indexOf(i);
          const sitio = sitioDeRanura(ranura);
          const enFrente = ranura === 0;
          // La del frente solo se desactiva si NO hay dónde ampliarla: un botón
          // vivo que no hace nada al tocarlo es peor que uno apagado.
          const ampliable = enFrente && ampliar !== null;
          return (
            <button
              key={`${escena.id}-${i}`}
              type="button"
              className="og-book-vit-carta"
              data-slot={sitio}
              data-ampliable={ampliable ? "" : undefined}
              disabled={enFrente && !ampliable}
              aria-label={
                enFrente
                  ? t("vitrinaAmpliar")
                  : t("vitrinaAlFrente", { n: i + 1 })
              }
              onClick={(e) => {
                if (!enFrente) {
                  setRanuras((r) => traerAlFrente(r, i));
                  return;
                }
                ampliar?.(pieza, pieza.titulo || nombre, e.currentTarget);
              }}
            >
              {/* Capa interior SOLO para la entrada por scroll. El `transform`
                  de la carta ES su sitio en el carrusel y lo gobierna la
                  transición del CSS: si la coreografía lo animara, se lo
                  arrebataría y la vitrina dejaría de poder cambiar de carta. */}
              <span className="og-book-vit-cuerpo">
                <BookPiece
                  pieza={pieza}
                  alt={pieza.titulo || nombre}
                  // La del frente ocupa media escena; las de atrás, poco más de
                  // un cuarto. Servirles la misma foto multiplicaría los bytes
                  // en la escena que más se mira.
                  sizes={
                    enFrente
                      ? "(max-width: 48rem) 58vw, 24vw"
                      : "(max-width: 48rem) 34vw, 14vw"
                  }
                  usarRatio={false}
                />
              </span>
            </button>
          );
        })}
      </div>

      {(alFrente?.titulo || alFrente?.nota) && (
        // La `key` es lo que hace que el texto vuelva a entrar al cambiar de
        // carta: sin ella React reutilizaría el nodo, el contenido cambiaría de
        // golpe a mitad del viaje y se perdería el relevo.
        <figcaption key={ranuras[0]} className="og-book-vit-cita">
          {alFrente.nota && (
            <blockquote className="og-book-vit-frase">
              {alFrente.nota}
            </blockquote>
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
