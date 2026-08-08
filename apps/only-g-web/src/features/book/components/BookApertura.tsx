"use client";

import { useTranslations } from "next-intl";
import { META_ESQUINAS, type EscenaBook } from "@only-g/shared-types/book";
import { BookPiece } from "./BookPiece";

/**
 * LA APERTURA (§10) — la primera escena, idéntica en todos los books y no
 * modificable.
 *
 * La secuencia, tal cual la pidió el usuario:
 *   1. La primera foto llena la pantalla, con el nombre de la modelo en medio.
 *   2. Al bajar, el nombre SE DISPERSA hacia arriba mientras la foto se
 *      DESENFOCA por completo, hasta dejar ver el color de fondo de su atmósfera.
 *   3. A la vez, las otras dos fotos SUBEN desde abajo, en diagonal —una debajo
 *      de la otra—, con un recorrido leve por dentro de sí mismas, y se colocan.
 *
 * POR QUÉ ESTO NO ES UNA REJILLA. El resto de escenas son composiciones: dices
 * dónde va cada foto y el navegador la coloca. Esto es una COREOGRAFÍA: tres
 * capas que se cruzan en el tiempo sobre un mismo escenario. Meterlo en
 * `grid-template-areas` sería describir el sitio de unas piezas que se pasan
 * media secuencia fuera de él.
 *
 * Y POR QUÉ UN RECORRIDO PROPIO (`.og-book-apertura`, alto en `svh`) CON UN
 * ESCENARIO PEGAJOSO DENTRO. La primera versión era una sola caja con
 * `min-height: 100svh` y alturas en porcentaje encadenadas, y eso hacía justo lo
 * que se reportó: en escritorio ocupaba MÁS que la pantalla —un `height: 100%`
 * contra un padre de altura indefinida no resuelve, así que mandaba el
 * contenido— y no había ningún recorrido durante el cual la foto pudiera irse.
 * Con `sticky`, el escenario mide una pantalla EXACTA y el track de arriba es el
 * que da el scroll que consume la secuencia. Es el mismo reparto que ya usa el
 * hero de la home.
 */
export function BookApertura({
  escena,
  nombre,
}: {
  escena: EscenaBook;
  nombre: string;
}) {
  const t = useTranslations("book");
  // El orden es el contrato de la apertura: ver `ROLES_APERTURA` en el dominio.
  const [principal, segunda, tercera, portada] = escena.piezas;
  if (!principal) return null;

  return (
    <section className="og-book-escena" data-tipo="portada" data-sobre-foto="si">
      <div className="og-book-apertura">
        <div className="og-book-ap-escenario">
          {/* Capa 1 — la foto que abre. Se desenfoca hasta desaparecer. */}
          <div className="og-book-ap-principal">
            <BookPiece
              pieza={principal}
              alt={nombre}
              sizes="100vw"
              priority
              usarRatio={false}
            />
          </div>

          {/* El nombre, en medio. Se dispersa hacia arriba al bajar. */}
          <div className="og-book-ap-nombre">
            <h1 className="og-book-titulo-portada">{nombre}</h1>
            <p className="og-book-pista">{t("scrollHint")}</p>
          </div>

          {/* Capas 2 y 3 — suben desde abajo en diagonal. Sin texto: son
              imagen pura, y así lo pidió el brief. */}
          {segunda && (
            <div className="og-book-ap-diagonal" data-orden="1">
              <BookPiece
                pieza={segunda}
                alt=""
                sizes="(max-width: 48rem) 62vw, 34vw"
                usarRatio={false}
              />
            </div>
          )}
          {tercera && (
            <div className="og-book-ap-diagonal" data-orden="2">
              <BookPiece
                pieza={tercera}
                alt=""
                sizes="(max-width: 48rem) 62vw, 34vw"
                usarRatio={false}
              />
            </div>
          )}

          {/* Capa 4 — LA FOTO DE PORTADA. Contenida, con su texto, y con el
              desintegrado que la arma y la deshace. Debajo de las teselas queda
              la foto entera: si el motor no llega, es lo único que se ve, y es
              una foto perfecta. */}
          {portada && (
            <div className="og-book-ap-portada">
              <div className="og-book-ap-portada-marco">
                <div className="og-book-ap-portada-plena">
                  <BookPiece
                    pieza={portada}
                    alt={portada.titulo || nombre}
                    sizes="(max-width: 48rem) 74vw, 30vw"
                    usarRatio={false}
                  />
                </div>
                {/* Las teselas las construye el motor: dependen del tamaño real
                    del marco, que solo se sabe en el navegador. */}
                <div className="og-book-desint" data-src={portada.url} />
              </div>

              {(portada.titulo || portada.nota) && (
                <div className="og-book-ap-portada-texto">
                  {portada.titulo && (
                    <p className="og-book-ap-portada-titulo">{portada.titulo}</p>
                  )}
                  {portada.nota && (
                    <p className="og-book-ap-portada-nota">{portada.nota}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {escena.meta && (
            <div className="og-book-meta" aria-hidden="true">
              {META_ESQUINAS.map((k) => (
                <span key={k}>{escena.meta?.[k] ?? ""}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
