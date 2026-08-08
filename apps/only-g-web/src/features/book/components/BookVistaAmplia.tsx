"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { PiezaBook } from "@only-g/shared-types/book";
import { CloseIcon } from "@/components/icons";

/**
 * LA VISTA AMPLIA (§10) — la foto CRECE DESDE SU SITIO hasta ocupar la pantalla.
 *
 * Es un FLIP hecho a mano y no una ventana que aparece: se mide dónde está la
 * foto ahora, se pinta una copia ya colocada en su tamaño FINAL, y se la empuja
 * hacia atrás con la transformación que la deja calcada sobre la original. Al
 * quitarle esa transformación, el navegador interpola — y lo que se ve es la
 * foto creciendo desde donde estaba. Lento a propósito: es el efecto, no un
 * trámite para llegar a la foto.
 *
 * TRES DECISIONES QUE NO SON DE GUSTO:
 *
 * 1. VUELA POR `transform`, NUNCA por `left/top/width/height`. Animar la caja
 *    obliga al navegador a recalcular la página en cada fotograma; `transform`
 *    lo mueve el compositor. En un móvil es la diferencia entre un efecto y un
 *    tartamudeo.
 *
 * 2. EL DESTINO CONSERVA LA PROPORCIÓN DEL ORIGEN, así que la escala es
 *    UNIFORME. Si el destino tuviera otra forma haría falta un escalado
 *    distinto por eje, y eso deforma la foto durante todo el viaje. Sale gratis
 *    porque el recorte que se ve ya es el del marco: la foto no cambia de
 *    encuadre, solo de tamaño.
 *
 * 3. SE PINTA CON UN PORTAL A `<body>`. `.og-book-escena` declara
 *    `container-type: inline-size`, que implica contención de layout — y un
 *    elemento con contención se convierte en el bloque contenedor de sus
 *    descendientes `position: fixed`. Dentro de la escena, "pantalla completa"
 *    habría significado "la escena completa". Es la misma trampa del popover de
 *    cristal que ya nos costó una tarde.
 *
 * Fuera del book (el editor, las miniaturas) no hay proveedor y el hook devuelve
 * `null`: quien lo use pinta su versión de siempre, sin ampliar.
 */

/** Lo que dura el viaje. Generoso a propósito: el brief pide poder apreciarlo. */
const DURACION = 900;

/** Cuánto de la pantalla puede llegar a ocupar. Pegada a los bordes se lee como
 *  un fallo de maquetación, no como una foto a pantalla completa. */
const MARGEN = 0.94;

interface Caja {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Abrir = (pieza: PiezaBook, alt: string, origen: HTMLElement) => void;

const Ctx = createContext<Abrir | null>(null);

/**
 * Devuelve la función de ampliar, o `null` si no hay proveedor encima. Devolver
 * `null` en vez de una función vacía es deliberado: quien llama tiene que poder
 * decidir si pinta el botón, y un botón que no hace nada es peor que no tenerlo.
 */
export function useVistaAmplia(): Abrir | null {
  return useContext(Ctx);
}

/** La caja más grande con la MISMA proporción que el origen que cabe en pantalla. */
function cajaDestino(origen: Caja): Caja {
  const anchoMax = window.innerWidth * MARGEN;
  const altoMax = window.innerHeight * MARGEN;
  const proporcion = origen.width / origen.height;

  let width = anchoMax;
  let height = anchoMax / proporcion;
  if (height > altoMax) {
    height = altoMax;
    width = altoMax * proporcion;
  }
  return {
    width,
    height,
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
  };
}

/**
 * La transformación que deja la caja de destino calcada sobre la de origen.
 * Depende de `transform-origin: top left` en el marco: con el origen en el
 * centro habría que compensar medio ancho y medio alto en cada término, y esa
 * es exactamente la clase de cuenta que se equivoca en silencio.
 */
function calcarSobre(origen: Caja, destino: Caja): string {
  const escala = origen.width / destino.width;
  return `translate(${origen.left - destino.left}px, ${
    origen.top - destino.top
  }px) scale(${escala})`;
}

const deRect = (r: DOMRect): Caja => ({
  left: r.left,
  top: r.top,
  width: r.width,
  height: r.height,
});

interface Vista {
  pieza: PiezaBook;
  alt: string;
  /** La foto de la que sale y a la que vuelve. Se esconde mientras dura la vista. */
  foto: HTMLElement;
  desde: Caja;
  /** Si el visitante pidió menos movimiento, el viaje es instantáneo. */
  suave: boolean;
}

export function ProveedorVistaAmplia({ children }: { children: ReactNode }) {
  const t = useTranslations("book");
  const [vista, setVista] = useState<Vista | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const marco = useRef<HTMLDivElement>(null);
  const destino = useRef<Caja | null>(null);
  const temporizador = useRef<number | undefined>(undefined);

  const abrir = useCallback<Abrir>((pieza, alt, origen) => {
    // Se mide la PIEZA, no el botón: en la vitrina el botón es la carta entera y
    // en la apertura el marco de la diagonal, pero lo que el ojo ve crecer —y lo
    // que hay que esconder— es la foto.
    const foto =
      origen.querySelector<HTMLElement>(".og-book-pieza") ?? origen;

    // El bloqueo del scroll va ANTES de medir. Al quitar la barra la página se
    // recentra unos píxeles, y una medida tomada antes haría arrancar la foto
    // ligeramente desplazada de donde el visitante la está viendo.
    document.body.style.overflow = "hidden";
    const desde = deRect(foto.getBoundingClientRect());
    if (desde.width < 1 || desde.height < 1) {
      document.body.style.overflow = "";
      return;
    }

    foto.style.visibility = "hidden";
    setVista({
      pieza,
      alt,
      foto,
      desde,
      suave: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }, []);

  /** El viaje de ida. Va en un efecto porque necesita el nodo ya montado. */
  useEffect(() => {
    const el = marco.current;
    if (!vista || !el) return;

    const hasta = cajaDestino(vista.desde);
    destino.current = hasta;

    Object.assign(el.style, {
      left: `${hasta.left}px`,
      top: `${hasta.top}px`,
      width: `${hasta.width}px`,
      height: `${hasta.height}px`,
      transition: "none",
      transform: calcarSobre(vista.desde, hasta),
    });

    // Esta lectura NO sobra. Sin ella el navegador agrupa las dos escrituras de
    // `transform` en el mismo recálculo, no llega a existir el estado inicial y
    // no hay nada que interpolar: la foto aparecería ya grande.
    void el.getBoundingClientRect();

    el.style.transition = vista.suave
      ? `transform ${DURACION}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : "none";
    el.style.transform = "none";
  }, [vista]);

  const cerrar = useCallback(() => {
    if (!vista || cerrando) return;
    setCerrando(true);

    const el = marco.current;
    const hasta = destino.current;
    // Se REMIDE en vez de reusar la medida de la ida: entre medias pudo cambiar
    // el ancho de la ventana, y volver al hueco de antes se vería como un salto.
    const vuelta = deRect(vista.foto.getBoundingClientRect());

    if (el && hasta && vuelta.width >= 1) {
      el.style.transform = calcarSobre(vuelta, hasta);
    } else if (el) {
      // La foto de origen ya no está en la página. No hay sitio al que volver:
      // se apaga donde está, que es lo menos parecido a un error.
      el.style.transition = `opacity ${DURACION / 2}ms ease`;
      el.style.opacity = "0";
    }

    const espera = vista.suave ? DURACION : 0;
    temporizador.current = window.setTimeout(() => {
      vista.foto.style.visibility = "";
      document.body.style.overflow = "";
      destino.current = null;
      setCerrando(false);
      setVista(null);
    }, espera);
  }, [vista, cerrando]);

  /** Escape cierra. Es lo primero que prueba quien no encuentra el botón. */
  useEffect(() => {
    if (!vista) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [vista, cerrar]);

  /**
   * Al cambiar el ancho —o al esconderse la barra del navegador en el móvil— se
   * recoloca la caja SIN tocar la transformación: la foto sigue en su sitio y el
   * viaje de vuelta se calcula sobre la caja nueva.
   */
  useEffect(() => {
    if (!vista) return;
    const alRedimensionar = () => {
      const el = marco.current;
      if (!el) return;
      const hasta = cajaDestino(vista.desde);
      destino.current = hasta;
      Object.assign(el.style, {
        left: `${hasta.left}px`,
        top: `${hasta.top}px`,
        width: `${hasta.width}px`,
        height: `${hasta.height}px`,
      });
    };
    window.addEventListener("resize", alRedimensionar);
    return () => window.removeEventListener("resize", alRedimensionar);
  }, [vista]);

  /** Desmontar con la vista abierta dejaría el scroll bloqueado y la foto oculta. */
  useEffect(() => {
    return () => {
      window.clearTimeout(temporizador.current);
      document.body.style.overflow = "";
    };
  }, []);

  const capa = vista ? (
    <div
      className="og-book-lupa"
      data-cerrando={cerrando ? "" : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={vista.alt}
    >
      {/* El fondo es también el sitio donde se toca para salir: en una foto a
          pantalla completa, tocar fuera es el gesto que todo el mundo intenta
          antes de buscar la cruz. */}
      <button
        type="button"
        className="og-book-lupa-fondo"
        aria-label={t("cerrarVista")}
        onClick={cerrar}
      />

      <div ref={marco} className="og-book-lupa-marco">
        {vista.pieza.tipo === "video" ? (
          <video
            src={vista.pieza.url}
            poster={vista.pieza.poster}
            muted
            loop
            playsInline
            autoPlay
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <Image
            src={vista.pieza.url}
            alt={vista.alt}
            fill
            sizes="100vw"
            className="object-cover"
            style={{
              objectPosition:
                vista.pieza.foco === "arriba"
                  ? "top"
                  : vista.pieza.foco === "abajo"
                    ? "bottom"
                    : "center",
            }}
          />
        )}
      </div>

      {/* Sutil, como pide el brief: no compite con la foto, pero está donde la
          mano va a buscarlo. */}
      <button
        type="button"
        className="og-book-lupa-cerrar"
        onClick={cerrar}
        aria-label={t("cerrarVista")}
      >
        <CloseIcon className="size-5" />
      </button>

      {(vista.pieza.titulo || vista.pieza.nota) && (
        <div className="og-book-lupa-pie">
          {vista.pieza.titulo && (
            <p className="og-book-display text-sm tracking-[0.14em]">
              {vista.pieza.titulo}
            </p>
          )}
          {vista.pieza.nota && (
            <p className="mt-1 text-sm leading-relaxed opacity-75">
              {vista.pieza.nota}
            </p>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <Ctx.Provider value={abrir}>
      {children}
      {/* `document.body` solo existe en el navegador: en el render del servidor
          no se pinta nada, y no hace falta —la vista amplia nace de un clic. */}
      {capa && typeof document !== "undefined"
        ? createPortal(capa, document.body)
        : null}
    </Ctx.Provider>
  );
}
