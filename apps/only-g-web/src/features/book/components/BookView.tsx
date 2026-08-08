"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  redesDelCierre,
  type Book,
} from "@only-g/shared-types/book";
import type { SocialPlatform } from "@only-g/shared-types/artist";
import {
  ArrowLeftIcon,
  FacebookIcon,
  InstagramIcon,
  SpotifyIcon,
  ThreadsIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/icons";
import { BookScene } from "./BookScene";
import { ProveedorVistaAmplia } from "./BookVistaAmplia";
import "../book.css";

/** Icono por red. Exhaustivo: añadir una plataforma rompe el typecheck aquí. */
const ICONO: Record<SocialPlatform, typeof InstagramIcon> = {
  instagram: InstagramIcon,
  spotify: SpotifyIcon,
  youtube: YouTubeIcon,
  tiktok: TikTokIcon,
  x: XIcon,
  facebook: FacebookIcon,
  threads: ThreadsIcon,
};

/**
 * EL BOOK montado: la atmósfera arriba, las escenas en orden debajo.
 *
 * La atmósfera se aplica como ATRIBUTOS (`data-fondo`, `data-letra`,
 * `data-textura`) sobre un único contenedor, y el CSS cuelga de ahí. Nunca de
 * `:root`: el book de una modelo no puede teñir el resto de Only G cuando el
 * visitante vuelve a su perfil. El acento es la excepción razonable —es un color
 * libre dentro de un rango, no una opción de catálogo— y va como variable inline.
 */
export function BookView({
  book,
  slug,
  nombre,
  /** Redes del perfil. El book guarda plataformas; las URLs viven aquí. */
  socials = {},
  /** La dueña viendo un book sin publicar: se le avisa de que nadie más lo ve. */
  esBorrador = false,
}: {
  book: Book;
  slug: string;
  nombre: string;
  socials?: Partial<Record<SocialPlatform, string>>;
  esBorrador?: boolean;
}) {
  const t = useTranslations("book");
  const { atmosfera } = book;
  const raiz = useRef<HTMLElement>(null);

  /**
   * La coreografía entra por `import()` DINÁMICO: GSAP y sus plugins solo los
   * descarga quien abre un book. Y entra DESPUÉS del primer pintado, así que el
   * book es legible desde el primer momento aunque el motor tarde —o falle— en
   * llegar.
   *
   * `cancelado` existe porque el import es asíncrono y React desmonta rápido en
   * desarrollo (StrictMode): sin él, un book desmontado podría acabar montando
   * su coreografía sobre un DOM que ya no está.
   */
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let cancelado = false;
    let limpiar: (() => void) | undefined;

    import("../lib/motion")
      .then(({ montarCoreografia }) => {
        if (cancelado) return;
        limpiar = montarCoreografia(el, atmosfera);
      })
      .catch(() => {
        /* Sin motor, queda la línea base estática. Que es un book que funciona. */
      });

    return () => {
      cancelado = true;
      limpiar?.();
    };
    // El ritmo y el desintegrado remontan la coreografía entera: son otros
    // números en las mismas timelines —y otra receta de partículas—, y rehacerlas
    // es más barato y más honesto que parchearlas.
  }, [atmosfera, book.escenas]);

  return (
    <main
      ref={raiz}
      className="og-book-root"
      data-fondo={atmosfera.fondo}
      data-letra={atmosfera.letra}
      data-ritmo={atmosfera.ritmo}
      data-textura={atmosfera.textura}
    >
      {/* El proveedor de la VISTA AMPLIA no pinta ningún nodo propio (devuelve
          un fragmento y un portal a `<body>`), así que puede vivir aquí dentro
          sin romper el `flex` de la raíz — que es quien reparte el aire entre
          escenas y no admite un `div` de más en medio. */}
      <ProveedorVistaAmplia>
      {esBorrador && (
        <p
          className="sticky top-0 z-40 px-4 py-2 text-center text-xs tracking-[0.14em] uppercase"
          style={{ background: "var(--bk-acento)", color: "#0c0a12" }}
        >
          {t("draftNotice")}
        </p>
      )}

      {book.escenas.map((escena) => {
        // La capa superpuesta se calcula ANTES y se pasa ya resuelta a `null`.
        // Pasarla como una ristra de condicionales dentro del slot pintaría una
        // capa vacía sobre cada escena de contenido: `[false, false]` es un array
        // y un array es truthy, así que el `children &&` de la escena no filtra
        // nada. Un fallo que no se ve hasta que un clic no llega a la foto.
        // La APERTURA se pinta sola (`BookApertura`): el nombre va dentro de su
        // escenario porque tiene que dispersarse con la coreografía, no
        // superponerse desde fuera.
        const sobre: ReactNode = null;

        if (escena.tipo === "cierre") {
          const redes = redesDelCierre(escena, socials);
          return (
            <BookScene key={escena.id} escena={escena} nombre={nombre}>
              <div className="flex flex-col items-center">
                <p className="og-book-cierre-nombre">{nombre}</p>

                {redes.length > 0 && (
                  <div className="og-book-cierre-redes">
                    {redes.map(({ red, url }) => {
                      const Icono = ICONO[red];
                      return (
                        <a
                          key={red}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={red}
                          className="opacity-60 transition hover:opacity-100"
                        >
                          <Icono className="size-6" />
                        </a>
                      );
                    })}
                  </div>
                )}

                <Link
                  href={`/artistas/${slug}`}
                  className="mt-10 inline-flex items-center gap-3 rounded-full px-6 py-3 text-xs tracking-[0.2em] uppercase transition hover:opacity-80"
                  style={{
                    border: "1px solid var(--bk-line)",
                    background: "var(--bk-surf)",
                  }}
                >
                  <ArrowLeftIcon className="size-4" />
                  {t("back")}
                </Link>

                {/* La firma es lo único que la modelo no puede tocar: el book se
                    personaliza, pero sigue siendo de la casa. */}
                <span className="mt-8 text-[0.65rem] tracking-[0.32em] uppercase opacity-40">
                  Only G Music
                </span>
              </div>
            </BookScene>
          );
        }

        return (
          <BookScene
            key={escena.id}
            escena={escena}
            nombre={nombre}
            prioritaria={escena.tipo === "portada"}
          >
            {sobre}
          </BookScene>
        );
      })}
      </ProveedorVistaAmplia>
    </main>
  );
}
