"use client";

import type { CSSProperties, ReactNode } from "react";
import { areaDeRanura } from "@only-g/shared-types/gallery-layout";
import {
  META_ESQUINAS,
  escenaDef,
  medidaDeEscena,
  numeroDeFicha,
  type EscenaBook,
  type EscenaTipo,
  type PiezaBook,
  type RitmoId,
} from "@only-g/shared-types/book";
import { BookApertura } from "./BookApertura";
import { BookPiece } from "./BookPiece";
import { BookVitrina } from "./BookVitrina";

/**
 * Una ESCENA del book. Coloca sus piezas en las ranuras que declara el CSS
 * (`.og-book-grid[data-escena=…]`) y pinta los textos que esa escena admita.
 *
 * Aquí NO hay movimiento de scroll: este componente es la línea base estática —
 * la que se ve mientras GSAP no ha entrado, la que ve quien pide menos
 * movimiento y la que quedaría si el motor fallara al cargar. Si el book no se
 * entiende sin coreografía, la coreografía está tapando un problema.
 */

/**
 * `sizes` por escena. Escribirlo bien no es cosmética: sin esto `next/image`
 * asume `100vw` y sirve una foto de pantalla completa para una ficha de índice —
 * cuatro veces los bytes necesarios, justo en la escena que más piezas tiene.
 * Los porcentajes salen de la propia rejilla del CSS.
 */
const SIZES: Record<EscenaTipo, string> = {
  portada: "100vw",
  plena: "(max-width: 48rem) 100vw, 82rem",
  cierre: "100vw",
  diptico: "(max-width: 48rem) 100vw, 40vw",
  retrato: "(max-width: 48rem) 100vw, 45vw",
  ancla: "(max-width: 48rem) 100vw, 45vw",
  rejilla: "(max-width: 48rem) 50vw, 25vw",
  tira: "(max-width: 48rem) 78vw, 38vw",
  vitrina: "(max-width: 48rem) 100vw, 42vw",
  indice: "(max-width: 48rem) 100vw, 24vw",
};

/** Escenas a sangre: el pie va SOBRE la foto, no debajo. */
const PIE_SOBRE: ReadonlySet<EscenaTipo> = new Set(["portada", "cierre"]);

/**
 * El fondo desenfocado del índice NO puede ser una segunda descarga completa.
 * `next/image` sirve `/_next/image?url=…&w=…`, así que apuntar a la URL cruda de
 * Storage bajaría la foto DOS VECES. Se pide la misma por el mismo optimizador
 * pero a 64 px: para un desenfoque de 22 px sobra de largo, y pesa unos 2 KB.
 */
function fondoBorroso(url: string): string {
  return `url("/_next/image?url=${encodeURIComponent(url)}&w=64&q=40")`;
}

function Pie({ pieza, sobre }: { pieza: PiezaBook; sobre: boolean }) {
  if (!pieza.titulo && !pieza.nota) return null;
  return (
    <figcaption className={sobre ? "og-book-pie-sobre" : ""}>
      {pieza.titulo && (
        <p className="og-book-display text-sm tracking-[0.14em] sm:text-base">
          {pieza.titulo}
        </p>
      )}
      {pieza.nota && (
        <p
          className="mt-1.5 max-w-prose text-sm leading-relaxed"
          style={{
            color: sobre ? "rgb(255 255 255 / 0.82)" : "var(--bk-ink-soft)",
          }}
        >
          {pieza.nota}
        </p>
      )}
    </figcaption>
  );
}

export function BookScene({
  escena,
  nombre,
  ritmo,
  /** Solo la portada: es la única pieza que se ve sin haber hecho scroll. */
  prioritaria = false,
  /**
   * Contenido superpuesto de las escenas a sangre — el nombre de la portada, la
   * despedida del cierre. Va como slot porque el cierre necesita el enlace de
   * vuelta al perfil, y el slug es cosa de quien monta el book.
   */
  children,
}: {
  escena: EscenaBook;
  nombre: string;
  ritmo: RitmoId;
  prioritaria?: boolean;
  children?: ReactNode;
}) {
  const def = escenaDef(escena.tipo);
  if (!def) return null;

  // La APERTURA no es una composición sino una coreografía de tres capas sobre
  // un mismo escenario: se gobierna sola. Delega entera en vez de llenar esta
  // función de excepciones que solo valen para ella.
  if (escena.tipo === "portada") {
    return <BookApertura escena={escena} nombre={nombre} />;
  }

  // El cierre puede no llevar foto: es texto y la puerta de vuelta al perfil.
  if (escena.piezas.length === 0 && escena.tipo !== "cierre") return null;

  const sobre = PIE_SOBRE.has(escena.tipo);
  const conNotas = def.maxNotas > 0 && (escena.notas?.length ?? 0) > 0;
  const esIndice = escena.tipo === "indice";
  // La pieza de `ancla` se queda quieta mientras el texto pasa. El `sticky` va
  // en la CELDA de la rejilla, no en la foto: dentro de la figura no hay
  // recorrido donde pegarse, porque la figura mide justo lo que mide la foto.
  const anclada = escena.tipo === "ancla";
  const medida = medidaDeEscena(escena);
  // Decide de qué color van la retícula y los metadatos: sobre una foto, blanco;
  // sobre el fondo de la atmósfera, la tinta de la paleta.
  const sobreFoto = escena.piezas.length > 0 && sobre ? "si" : "no";

  return (
    <section
      className="og-book-escena"
      data-tipo={escena.tipo}
      data-sobre-foto={sobreFoto}
      aria-label={escena.encabezado || undefined}
    >
      {/* La vitrina se gobierna sola: su reparto de ranuras es estado de React,
          no una colocación fija. Delega ENTERA en vez de llenar esta función de
          condicionales que solo valen para ella. */}
      {escena.tipo === "vitrina" ? (
        <BookVitrina escena={escena} nombre={nombre} />
      ) : (
        <>
          {escena.encabezado && !sobre && !def.textoEnRejilla && (
            <h2 className="og-book-display px-4 pt-4 pb-6 text-3xl sm:px-8 sm:text-5xl">
              {escena.encabezado}
            </h2>
          )}

          <div
            className="og-book-grid"
            data-escena={escena.tipo}
            data-medida={medida}
            // La rejilla declara sus áreas por número de piezas: con tres fotos
            // en dos columnas, una rejilla elástica dejaría un hueco.
            data-piezas={escena.piezas.length}
          >
            {escena.encabezado && def.textoEnRejilla && (
              <h2
                className="og-book-display text-2xl sm:text-4xl"
                style={{ gridArea: "h" }}
              >
                {escena.encabezado}
              </h2>
            )}

            {escena.piezas.map((pieza, i) => (
              <figure
                key={`${escena.id}-${i}`}
                className={`og-book-figura ${anclada ? "og-book-anclada" : ""}`}
                style={
                  {
                    gridArea: areaDeRanura(i),
                    // Las variables CSS heredan: puesta aquí, la lee el
                    // `::before` de la pieza sin tener que atravesar props.
                    ...(esIndice ? { "--bk-fondo": fondoBorroso(pieza.url) } : {}),
                  } as CSSProperties
                }
              >
                {/* La ficha del índice lleva su crédito arriba, sobre una línea:
                    es lo que la convierte en catálogo en vez de en una foto más. */}
                {esIndice && pieza.etiqueta && (
                  <div className="og-book-ficha-meta">
                    <span>{pieza.etiqueta}</span>
                  </div>
                )}

                <BookPiece
                  pieza={pieza}
                  // El título de la pieza ("Editorial · Bogotá Fashion Week") es
                  // mejor texto alternativo que el nombre repetido veintiocho
                  // veces, que es lo que oiría quien use un lector de pantalla.
                  alt={pieza.titulo || nombre}
                  sizes={SIZES[escena.tipo]}
                  priority={prioritaria && i === 0}
                  // En la rejilla y el índice mandan las proporciones del CSS:
                  // fotos de cámaras distintas con su ratio real dan una
                  // cuadrícula dentada.
                  usarRatio={escena.tipo !== "rejilla" && !esIndice}
                />

                {esIndice ? (
                  <div className="og-book-ficha-pie">
                    <span>{pieza.titulo}</span>
                    {/* El número se DERIVA del sitio: reordenar no deja huecos. */}
                    <span className="og-book-ficha-num">{numeroDeFicha(i)}</span>
                  </div>
                ) : (
                  // Las escenas que reservan el área `n` pintan su texto AHÍ, no
                  // aquí dentro. Si se quedara en la figura, las columnas que el
                  // CSS reservó al lado de la foto se verían en blanco.
                  def.admiteTextoPorPieza &&
                  !def.notaEnRejilla && <Pie pieza={pieza} sobre={sobre} />
                )}
              </figure>
            ))}

            {/* El texto de la pieza, en su columna. Es lo que cumple la promesa
                de "la foto a un lado, lo que cuenta al otro". */}
            {def.notaEnRejilla && escena.piezas[0] && (
              <div style={{ gridArea: "n" }} className="og-book-notas self-start">
                <Pie pieza={escena.piezas[0]} sobre={false} />
              </div>
            )}

            {conNotas && (
              <div
                style={{ gridArea: "n" }}
                // La clase es el asa por la que la coreografía agarra estos
                // bloques. Buscarlos por su `style` funcionaría hasta el día que
                // alguien cambie el área, y entonces fallaría sin decir nada.
                // En el cierre las dos frases van una a cada lado, no apiladas.
                className={
                  escena.tipo === "cierre"
                    ? "og-book-notas og-book-cierre-frases"
                    : "og-book-notas flex flex-col gap-10 py-6"
                }
              >
                {escena.notas!.map((nota, i) => (
                  <div key={i}>
                    {nota.titulo && (
                      <p
                        className="og-book-display text-xl sm:text-2xl"
                        style={{ color: "var(--bk-acento)" }}
                      >
                        {nota.titulo}
                      </p>
                    )}
                    {nota.texto && (
                      <p
                        className="mt-2 max-w-prose leading-relaxed"
                        style={{ color: "var(--bk-ink-soft)" }}
                      >
                        {nota.texto}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {children && (
              // La única escena que llega aquí con capa superpuesta es el
              // cierre: la apertura se pinta sola y centra su nombre dentro de
              // su propio escenario.
              <div className="og-book-sobre" style={{ gridArea: "a" }}>
                {children}
              </div>
            )}
          </div>
        </>
      )}

      {escena.meta && (
        <div className="og-book-meta" aria-hidden="true">
          {META_ESQUINAS.map((k) => (
            <span key={k}>{escena.meta?.[k] ?? ""}</span>
          ))}
        </div>
      )}
    </section>
  );
}
