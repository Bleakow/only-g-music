import type { DesintegradoId } from "@only-g/shared-types/book";

/**
 * EL DESINTEGRADO de la foto de portada — un motor y varias RECETAS.
 *
 * Han hecho falta tres intentos hasta dar con el efecto, y las dos primeras
 * versiones fallaban por la misma razón de fondo, así que conviene dejarla
 * escrita antes de nada:
 *
 *  · v1: teselas del DOM. Se veía lo que era, pedazos de cuadrado.
 *  · v2: un lienzo con la foto erosionándose y una NUBE de polvo encima. Se
 *    reportó dos veces "la foto se revela antes de que lleguen las partículas" —
 *    y no era cuestión de afinar el retardo: eran DOS EFECTOS PEGADOS. Una foto
 *    que se aclaraba por su cuenta y, aparte, arena volando. Por mucho que se
 *    sincronicen, el ojo separa lo que no está hecho de lo mismo.
 *  · v3, la de ahora: CADA PARTÍCULA LLEVA SU PÍXEL. Se muestrea la foto en una
 *    rejilla y sale un grano por celda con el color de esa celda; en reposo los
 *    granos tesela con tesela RECONSTRUYEN la imagen. Lo que se ve armarse es
 *    literalmente la nube.
 *
 * La foto de verdad se sigue dibujando debajo, pero su papel es RELLENAR los
 * huecos entre granos una vez han aterrizado, para que la foto quieta tenga
 * calidad de foto y no de mosaico. Nunca aparece antes que ellos: su borde va
 * por delante del frente de granos (ver `FOTO_TRAS_POLVO`).
 *
 * ── LAS RECETAS ────────────────────────────────────────────────────────────
 * La modelo elige CÓMO se deshace su portada, y eso es un eje más de la
 * atmósfera. Cada receta declara el tamaño de su celda, si dibuja color plano o
 * el recorte real de la foto, y DOS VUELOS —uno para llegar y otro para irse—
 * porque la salida no puede ser la entrada rebobinada: el ojo ya ha visto ese
 * movimiento cuatro pantallas antes y lo reconoce.
 *
 * Un vuelo declara solo su EJE y su viaje. El sitio de cada grano sobre ese eje
 * lo despeja el motor (`sitioEn`) en vez de escribirlo la receta, y eso mata de
 * raíz el fallo más caro de todo este archivo: si el sitio y el eje del
 * degradado no son EXACTAMENTE la misma cuenta, la foto se cierra por un lado
 * mientras la arena llega por otro. Aquí no pueden discrepar porque salen del
 * mismo sitio.
 *
 * ── LO QUE NO SE NEGOCIA ───────────────────────────────────────────────────
 * DETERMINISTA. Esto va atado al SCROLL y un scroll se recorre en los dos
 * sentidos: con `Math.random()` la foto se re-desperdigaría distinta al volver a
 * subir. El sitio de cada grano sale de su celda y su viaje, de un hash de su
 * índice.
 *
 * LA URL. `next/image` no sirve el archivo original sino una variante optimizada
 * por `/_next/image`, así que apuntar a la url de Storage descargaría la foto DOS
 * VECES. Se lee `currentSrc` de la imagen que ya está en la página: mismo
 * recurso, cero bytes de más — y de paso mismo origen, que es lo que permite leer
 * sus píxeles.
 */

import { construirBruma } from "./bruma";
import { construirCeniza } from "./ceniza";
import { construirLamas } from "./lamas";
import {
  BANDA,
  DISPERSION,
  FOTO_TRAS_POLVO,
  frenteDePolvo,
  ruido,
  turnoDeGrano,
  vueloDeGrano,
  type Polvo,
} from "./reloj-desintegrado";

// El reloj vive aparte (ver `reloj-desintegrado.ts`) pero la puerta de entrada de
// todo el desintegrado sigue siendo este módulo.
export {
  armandoEn,
  fasePolvo,
  frenteDePolvo,
  turnoDeGrano,
  vueloDeGrano,
  type Polvo,
} from "./reloj-desintegrado";

/** Tope duro de granos. Por encima, el paso de la receta se ensancha solo. */
const GRANOS_MAX = 17000;

/** Resolución máxima del lienzo. Más allá no se distingue y cuesta el doble. */
const DPR_MAX = 1.75;

// ─────────────────────────────────────────────────────────────────────────────
// El catálogo de recetas
// ─────────────────────────────────────────────────────────────────────────────

/** Geometría en píxeles del lienzo. La foto vive en `(ox, oy)` de tamaño `w×h`. */
interface Geo {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

/**
 * El eje sobre el que barre el frente. El degradado de la foto se construye con
 * ÉL, y el sitio de cada grano se despeja de ÉL: no pueden discrepar.
 */
interface Eje {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Dónde cae un punto del lienzo sobre el eje, en 0..1. */
function sitioEn(eje: Eje, x: number, y: number): number {
  const vx = eje.x1 - eje.x0;
  const vy = eje.y1 - eje.y0;
  return ((x - eje.x0) * vx + (y - eje.y0) * vy) / (vx * vx + vy * vy);
}

/** A dónde vuela un grano y cuánto gira por el camino, en píxeles del lienzo. */
interface Viaje {
  dx: number;
  dy: number;
  giro: number;
}

interface Vuelo {
  eje(g: Geo): Eje;
  viaje(i: number, nx: number, ny: number, g: Geo): Viaje;
}

/** Margen alrededor de la foto, en fracciones de su ancho y su alto. */
interface Margen {
  arriba: number;
  derecha: number;
  abajo: number;
  izquierda: number;
}

interface Receta {
  /** Lado de la celda en píxeles de CSS. Fino = arena; grueso = cuadrados. */
  paso: number;
  /**
   * Dibuja el RECORTE REAL de la foto y lo gira, en vez de un cuadrado de color
   * plano. Solo tiene sentido con celdas grandes: son unos cientos de
   * `drawImage` con rotación, y con miles de granos costaría fotogramas.
   */
  trozo: boolean;
  /** Cuánto encoge un grano al final de su vuelo. */
  encoge: number;
  /**
   * Sitio para volar. Un lienzo RECORTA lo que se dibuja fuera, así que sin este
   * margen los granos se estrellarían contra su propio borde y desaparecerían en
   * una línea recta invisible — como si chocaran con un cristal. Cada receta
   * reserva por donde vuela la suya, porque el margen se paga en píxeles que hay
   * que limpiar en cada fotograma.
   */
  margen: Margen;
  llega: Vuelo;
  seVa: Vuelo;
}

/** Eje vertical de abajo (0) a arriba (1). */
const subiendo = (g: Geo): Eje => ({
  x0: g.ox,
  y0: g.oy + g.h,
  x1: g.ox,
  y1: g.oy,
});

/** Eje vertical de arriba (0) a abajo (1). */
const bajando = (g: Geo): Eje => ({
  x0: g.ox,
  y0: g.oy,
  x1: g.ox,
  y1: g.oy + g.h,
});

/** Eje horizontal de izquierda (0) a derecha (1). */
const haciaLaDerecha = (g: Geo): Eje => ({
  x0: g.ox,
  y0: g.oy,
  x1: g.ox + g.w,
  y1: g.oy,
});

/** Eje horizontal de derecha (0) a izquierda (1). */
const haciaLaIzquierda = (g: Geo): Eje => ({
  x0: g.ox + g.w,
  y0: g.oy,
  x1: g.ox,
  y1: g.oy,
});

/**
 * EL CATÁLOGO. Añadir un desintegrado nuevo es añadir su id en el dominio y su
 * receta aquí: el motor no se toca.
 *
 * Cada receta cuenta DOS movimientos distintos, y esa es la regla que las hace
 * buenas. Si la llegada y la salida usan el mismo eje y el mismo viaje, la
 * segunda mitad de la secuencia es la primera rebobinada y se nota.
 */
type MotorAparte = (
  capaHost: HTMLElement,
  anchoCss: number,
  altoCss: number,
  dibujarFoto: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) => Polvo | null;

/**
 * Los efectos que NO son una receta de este motor. Cada uno tiene su módulo
 * porque su mecanismo es otro, no porque sus números sean otros — y esa es la
 * línea: si algo se puede contar con un eje y un viaje, es una receta; si
 * necesita girar tiras o precocinar desenfoques, es un motor.
 */
const MOTORES_APARTE = {
  ceniza: construirCeniza,
  lamas: construirLamas,
  bruma: construirBruma,
  // `satisfies` y no una anotación: así las claves quedan como el literal exacto
  // y `RECETAS` puede excluirlas. Anotado como `Partial<Record<DesintegradoId,…>>`,
  // `keyof` sería TODO el catálogo, la exclusión lo vaciaría, y las recetas se
  // quedarían sin tipo — que fue justo lo que pasó al escribirlo así.
} satisfies Partial<Record<DesintegradoId, MotorAparte>>;

type ConMotorPropio = keyof typeof MOTORES_APARTE;

/**
 * Y esto es lo que cierra el catálogo: un id que no tenga motor propio TIENE que
 * tener receta, o no compila. No hay forma de añadir un desintegrado y olvidarse
 * de darle movimiento.
 */
const RECETAS: Record<Exclude<DesintegradoId, ConMotorPropio>, Receta> = {
  /**
   * ARENA — la de casa. Se posa cayendo desde arriba y se la lleva el viento de
   * lado. Granos diminutos, color plano, miles de ellos.
   */
  arena: {
    paso: 3.4,
    trozo: false,
    encoge: 0.55,
    margen: { arriba: 0.7, derecha: 0.75, abajo: 0.05, izquierda: 0.08 },
    llega: {
      // La imagen cuaja del techo hacia el suelo: al armar, el frente retrocede
      // desde el sitio 1 (arriba) hacia el 0.
      eje: subiendo,
      viaje: (i, _nx, _ny, g) => ({
        // Poca deriva de lado y sesgada a la derecha, que es por donde el lienzo
        // tiene sitio: por la izquierda apenas hay margen y ahí sí corta.
        dx: (ruido(i + 8121581) - 0.35) * 0.2 * g.w,
        dy: -(0.45 + ruido(i + 5772019) * 0.75) * g.h,
        giro: 0,
      }),
    },
    seVa: {
      // La diagonal del viento, de abajo-izquierda a arriba-derecha.
      eje: (g) => ({
        tipo: "linea",
        x0: g.ox,
        y0: g.oy + g.h,
        x1: g.ox + g.w,
        y1: g.oy,
      }),
      viaje: (i, _nx, _ny, g) => {
        const empuje = 0.4 + ruido(i) * 0.95;
        return {
          dx: empuje * g.w,
          dy: (-0.34 * empuje + (ruido(i + 15485863) - 0.5) * 0.6) * g.h,
          giro: 0,
        };
      },
    },
  },

  /**
   * TESELAS — la primera versión, rescatada. Cuadrados grandes que llevan su
   * recorte REAL de la foto y giran al volar. Más gráfico que atmosférico: se
   * lee como una composición que se desmonta, no como algo que se deshace.
   *
   * En lienzo y no en nodos del DOM, que es lo que la mató la primera vez: cien
   * capas de composición dejaban una rejilla de juntas claras sobre la foto.
   */
  teselas: {
    paso: 26,
    trozo: true,
    encoge: 0.3,
    margen: { arriba: 0.5, derecha: 0.6, abajo: 0.4, izquierda: 0.4 },
    llega: {
      // Cuaja de abajo arriba, como una pila que se apila.
      eje: bajando,
      viaje: (i, _nx, _ny, g) => ({
        dx: (ruido(i + 6700417) - 0.7) * 0.7 * g.w,
        dy: (0.3 + ruido(i + 2038074743) * 0.6) * g.h,
        giro: (ruido(i + 32452843) - 0.5) * 2.6,
      }),
    },
    seVa: {
      // Y se desmonta de izquierda a derecha.
      eje: haciaLaDerecha,
      viaje: (i, _nx, _ny, g) => ({
        dx: (0.35 + ruido(i + 179424673) * 0.8) * g.w,
        dy: (ruido(i + 86028121) - 0.55) * 0.6 * g.h,
        giro: (ruido(i + 15485863) - 0.5) * 3.4,
      }),
    },
  },

  /**
   * CASCADA — llega de lado, en horizontal, y se derrama hacia abajo. Es la más
   * tranquila de las cuatro: ni gira ni estalla, se llena y se vacía.
   */
  cascada: {
    paso: 3.2,
    trozo: false,
    encoge: 0.5,
    margen: { arriba: 0.08, derecha: 0.15, abajo: 0.9, izquierda: 0.7 },
    llega: {
      // Cuaja de izquierda a derecha: el frente retrocede desde el sitio 1, que
      // en este eje es el borde izquierdo.
      eje: haciaLaIzquierda,
      viaje: (i, _nx, _ny, g) => ({
        dx: -(0.35 + ruido(i + 373587883) * 0.55) * g.w,
        dy: (ruido(i + 700000001) - 0.5) * 0.16 * g.h,
        giro: 0,
      }),
    },
    seVa: {
      // Y se vacía por abajo: el frente avanza desde el sitio 0, el borde de
      // abajo, así que la imagen se hunde en vez de destaparse.
      eje: subiendo,
      viaje: (i, _nx, _ny, g) => ({
        dx: (ruido(i + 512927377) - 0.5) * 0.22 * g.w,
        dy: (0.5 + ruido(i + 941083987) * 0.8) * g.h,
        giro: 0,
      }),
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// El motor
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Espera a que la imagen esté cargada para poder leer su `currentSrc`. Antes de
 * cargar es cadena vacía y no habría nada de donde sacar los colores.
 */
export function urlYaCargada(img: HTMLImageElement): Promise<string> {
  if (img.complete && img.currentSrc) return Promise.resolve(img.currentSrc);
  return new Promise((resolve) => {
    const listo = () => resolve(img.currentSrc || img.src);
    img.addEventListener("load", listo, { once: true });
    img.addEventListener("error", listo, { once: true });
  });
}

function cargar(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Mismo origen (`/_next/image`), así que no hay CORS que negociar. Se declara
    // igualmente: si algún día una pieza viniera de otro dominio, sin esto el
    // lienzo quedaría contaminado y `getImageData` lanzaría.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * El recorte que hace `object-fit: cover` con su `object-position`. Hay que
 * replicarlo a mano: el lienzo dibuja la foto entera y el DOM la enseñaba
 * recortada, así que sin esto los granos tomarían su color de una foto ENCUADRADA
 * DISTINTA a la que el visitante estaba viendo.
 */
function recorteCover(
  iw: number,
  ih: number,
  w: number,
  h: number,
  fx: number,
  fy: number,
) {
  const escala = Math.max(w / iw, h / ih);
  const dw = iw * escala;
  const dh = ih * escala;
  return { x: (w - dw) * fx, y: (h - dh) * fy, w: dw, h: dh };
}

/** `object-position` del elemento, como dos fracciones 0..1. */
function anclaDe(img: HTMLImageElement): [number, number] {
  const bruto = getComputedStyle(img).objectPosition || "50% 50%";
  const partes = bruto.split(/\s+/);
  const frac = (v: string | undefined, porDefecto: number) => {
    if (!v) return porDefecto;
    if (v.endsWith("%")) return Math.min(1, Math.max(0, parseFloat(v) / 100));
    if (v === "left" || v === "top") return 0;
    if (v === "right" || v === "bottom") return 1;
    if (v === "center") return 0.5;
    return porDefecto;
  };
  return [frac(partes[0], 0.5), frac(partes[1], 0.5)];
}

/** Los arrays de un vuelo, ya rellenos y ordenados como el resto. */
interface VueloListo {
  dx: Float32Array;
  dy: Float32Array;
  giro: Float32Array;
  turno: Float32Array;
  eje: Eje;
}

/**
 * Monta el lienzo dentro de `capa`, del tamaño de `marco`, con la foto que `img`
 * está enseñando y la receta que eligió la modelo. Devuelve `null` si algo falla
 * — y entonces se queda la foto del DOM, que es una foto perfecta. El
 * desintegrado es un adorno; la foto, no.
 */
export async function construirPolvo(
  marco: HTMLElement,
  capa: HTMLElement,
  img: HTMLImageElement,
  url: string,
  desintegrado: DesintegradoId,
): Promise<Polvo | null> {
  const anchoCss = marco.clientWidth;
  const altoCss = marco.clientHeight;
  if (!anchoCss || !altoCss) return null;

  const foto = await cargar(url);
  if (!foto || !foto.naturalWidth) return null;

  const [fx, fy] = anclaDe(img);

  // Tres de los efectos NO son recetas de este motor: son OTROS motores. Aquí
  // cada grano se dibuja por su cuenta, así que no puede bajar de tres píxeles
  // (ceniza), ni girar sobre un eje (lamas), ni dejar de ser un grano (bruma).
  // Se despachan desde aquí para que quien llama solo conozca una puerta, y
  // todos reciben lo mismo: dónde colgarse, cuánto miden y cómo pintar la foto.
  if (Object.hasOwn(MOTORES_APARTE, desintegrado)) {
    return MOTORES_APARTE[desintegrado as ConMotorPropio](capa, anchoCss, altoCss, (c, cw, ch) => {
      const recorte = recorteCover(
        foto.naturalWidth,
        foto.naturalHeight,
        cw,
        ch,
        fx,
        fy,
      );
      // Sin recortar a mano: el lienzo mide justo la caja, así que lo que sobra
      // del `cover` cae fuera y se descarta solo.
      c.drawImage(foto, recorte.x, recorte.y, recorte.w, recorte.h);
    });
  }

  // Aquí el id YA no puede ser de los que tienen motor propio —el `return` de
  // arriba se los llevó— pero TypeScript no lo sabe: el estrechamiento de
  // `Object.hasOwn` no viaja hasta este tipo. El `??` no es un por si acaso, es
  // la red de un documento con un id que ya no existe en el catálogo.
  const receta: Receta =
    (RECETAS as Partial<Record<DesintegradoId, Receta>>)[desintegrado] ??
    RECETAS.arena;

  const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
  // `w`/`h` son la caja de LA FOTO; el lienzo es más grande y la foto vive
  // dentro, en `(ox, oy)`.
  const w = Math.round(anchoCss * dpr);
  const h = Math.round(altoCss * dpr);
  const { margen } = receta;
  const ox = Math.round(w * margen.izquierda);
  const oy = Math.round(h * margen.arriba);
  const geo: Geo = { w, h, ox, oy };

  const lienzo = document.createElement("canvas");
  lienzo.className = "og-book-desint-lienzo";
  lienzo.width = Math.round(w * (1 + margen.izquierda + margen.derecha));
  lienzo.height = Math.round(h * (1 + margen.arriba + margen.abajo));
  // La caja se mide desde la de la foto, así que el marco sigue mandando y el
  // CSS no tiene que saber nada de estos márgenes.
  lienzo.style.left = `${-margen.izquierda * 100}%`;
  lienzo.style.top = `${-margen.arriba * 100}%`;
  lienzo.style.width = `${(1 + margen.izquierda + margen.derecha) * 100}%`;
  lienzo.style.height = `${(1 + margen.arriba + margen.abajo) * 100}%`;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;

  const cover = recorteCover(foto.naturalWidth, foto.naturalHeight, w, h, fx, fy);

  // ── La rejilla ────────────────────────────────────────────────────────────
  // El paso se ensancha solo si la foto es tan grande que se pasaría del tope:
  // un book abierto en un monitor de 27" no puede pedir el triple de granos que
  // uno abierto en un móvil solo porque hay sitio.
  const paso = Math.max(
    receta.paso,
    Math.sqrt((anchoCss * altoCss) / GRANOS_MAX),
  );
  const cols = Math.max(8, Math.round(anchoCss / paso));
  const filas = Math.max(8, Math.round(altoCss / paso));
  const total = cols * filas;
  const celdaW = w / cols;
  const celdaH = h / filas;

  // ── Los colores ───────────────────────────────────────────────────────────
  // El lienzo de muestreo tiene EXACTAMENTE el tamaño de la rejilla: un píxel por
  // grano. Así cada partícula lleva su píxel y en reposo la nube reconstruye la
  // foto, que es todo el sentido de esta versión.
  const mini = document.createElement("canvas");
  mini.width = cols;
  mini.height = filas;
  const mctx = mini.getContext("2d", { willReadFrequently: true });
  if (!mctx) return null;
  const coverMini = recorteCover(
    foto.naturalWidth,
    foto.naturalHeight,
    cols,
    filas,
    fx,
    fy,
  );
  mctx.drawImage(foto, coverMini.x, coverMini.y, coverMini.w, coverMini.h);

  let pixeles: Uint8ClampedArray;
  try {
    pixeles = mctx.getImageData(0, 0, cols, filas).data;
  } catch {
    // Lienzo contaminado (una pieza de otro dominio sin CORS). Sin colores no
    // hay granos, y una foto entera es mejor que un efecto a medias.
    return null;
  }

  // ── Los granos ────────────────────────────────────────────────────────────
  // En arrays paralelos y no en objetos: son decenas de miles, se recorren
  // enteros en cada fotograma, y un array de objetos ahí dentro es medio megabyte
  // de indirecciones que el recolector tiene que pasear.
  const hx = new Float32Array(total);
  const hy = new Float32Array(total);
  const celda = new Uint32Array(total);
  const cubos = new Uint32Array(total);
  const estilos = new Map<number, string>();

  const cubosSinOrdenar = new Uint32Array(total);
  for (let i = 0; i < total; i++) {
    const k = i * 4;
    // Tres bits por canal. Cuantizar agrupa los granos en pocas decenas de
    // cubos, y dibujar ORDENADO por cubo convierte miles de cambios de
    // `fillStyle` —que se parsean como texto y son lo caro de un lienzo— en unas
    // pocas decenas por fotograma.
    const r = pixeles[k] & 0xe0;
    const g = pixeles[k + 1] & 0xe0;
    const b = pixeles[k + 2] & 0xe0;
    const cubo = (r << 16) | (g << 8) | b;
    if (!estilos.has(cubo)) estilos.set(cubo, `rgb(${r} ${g} ${b})`);
    cubosSinOrdenar[i] = cubo;
  }

  // Ordenar UNA vez, al montar. Después el bucle de pintado ya sale barato.
  const ordenados = Array.from({ length: total }, (_, i) => i).sort(
    (a, b) => cubosSinOrdenar[a] - cubosSinOrdenar[b],
  );

  const prepararVuelo = (vuelo: Vuelo, sal: number): VueloListo => {
    const eje = vuelo.eje(geo);
    const listo: VueloListo = {
      dx: new Float32Array(total),
      dy: new Float32Array(total),
      giro: new Float32Array(total),
      turno: new Float32Array(total),
      eje,
    };
    for (let n = 0; n < total; n++) {
      const i = ordenados[n];
      const c = i % cols;
      const f = (i - c) / cols;
      const nx = (c + 0.5) / cols;
      const ny = (f + 0.5) / filas;
      const v = vuelo.viaje(i, nx, ny, geo);
      listo.dx[n] = v.dx;
      listo.dy[n] = v.dy;
      listo.giro[n] = v.giro;
      // El sitio se DESPEJA del eje, no lo escribe la receta: si las dos cuentas
      // pudieran discrepar, la foto se cerraría por un lado mientras la arena
      // llega por otro, y ese fallo se ve raro sin que nadie sepa por qué.
      const sitio = sitioEn(
        eje,
        ox + (c + 0.5) * celdaW,
        oy + (f + 0.5) * celdaH,
      );
      listo.turno[n] = turnoDeGrano(sitio, ruido(i + sal));
    }
    return listo;
  };

  for (let n = 0; n < total; n++) {
    const i = ordenados[n];
    const c = i % cols;
    const f = (i - c) / cols;
    hx[n] = ox + (c + 0.5) * celdaW;
    hy[n] = oy + (f + 0.5) * celdaH;
    celda[n] = i;
    cubos[n] = cubosSinOrdenar[i];
  }

  // Dos SALES distintas: si los dos vuelos compartieran el desorden, un grano
  // que llega tarde se iría siempre tarde, y el ojo pilla esas correlaciones
  // aunque no sepa nombrarlas.
  const llegada = prepararVuelo(receta.llega, 2971215073);
  const salida = prepararVuelo(receta.seVa, 49979687);

  capa.textContent = "";
  capa.appendChild(lienzo);
  capa.dataset.listo = "si";

  /**
   * El degradado que borra la foto por delante de los granos. Se construye con el
   * eje del vuelo que toque, y sus paradas van en el mismo espacio 0..1 en el que
   * se mide el sitio de cada grano — para el degradado lineal el desplazamiento
   * ES el sitio, y para el radial también, porque el radio va de 0 a `r`.
   *
   * Los topes van en el alfa de los extremos y no clavando paradas en 0 y 1: con
   * el frente todavía fuera del lienzo, una parada opaca en 0 borraría de golpe
   * la esquina entera en el primer fotograma.
   */
  const degradado = (frente: number, eje: Eje): CanvasGradient => {
    // La banda de la foto ocupa el PRIMER tramo del vuelo del grano, y se divide
    // entre `1 - DISPERSION` porque el turno está desordenado: `fin` tiene que
    // ser el sitio donde ni siquiera el grano MÁS ADELANTADO ha despegado. Si se
    // quedara en el frente, la foto asomaría por debajo de granos que aún no se
    // han movido — o sea, revelándose antes que ellos.
    const banda = (BANDA * FOTO_TRAS_POLVO) / (1 - DISPERSION);
    const fin = (frente + BANDA) / (1 - DISPERSION);
    const ini = fin - banda;
    const borrado = (s: number) => Math.min(1, Math.max(0, (fin - s) / banda));
    const g = ctx.createLinearGradient(eje.x0, eje.y0, eje.x1, eje.y1);
    g.addColorStop(0, `rgba(0,0,0,${borrado(0)})`);
    if (ini > 0 && ini < 1) g.addColorStop(ini, "rgba(0,0,0,1)");
    if (fin > 0 && fin < 1) g.addColorStop(fin, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${borrado(1)})`);
    return g;
  };

  // Lado del grano en reposo: la celda entera, redondeada hacia arriba para que
  // teselen sin dejar juntas. Al volar encoge.
  const lado = Math.ceil(Math.max(celdaW, celdaH));
  // De píxel del lienzo a píxel de la foto original, para los recortes.
  const aFuenteX = foto.naturalWidth / cover.w;
  const aFuenteY = foto.naturalHeight / cover.h;

  // Función FLECHA y no declaración: TypeScript no aplica el estrechamiento del
  // `if (!ctx) return null` de arriba dentro de una `function` —está izada, así
  // que podría llamarse antes—, y quedaría un archivo lleno de `ctx!`.
  const pintar = (progreso: number, armando: boolean): void => {
    const p = Math.min(1, Math.max(0, progreso));
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    const frente = frenteDePolvo(p);
    // El vuelo manda sobre TODO: los granos y el borde de la foto. Cambiar uno
    // sin el otro dejaría la foto cerrándose por un lado mientras la arena llega
    // por otro, que es peor que no haber partido el vuelo en dos.
    const vuelo = armando ? llegada : salida;

    if (p < 1) {
      ctx.globalAlpha = 1;
      // RECORTADA A SU CAJA. `object-fit: cover` significa por definición que la
      // foto SE SALE por uno de los dos ejes; en el DOM lo recortaba el
      // `overflow: hidden` de la pieza, pero un lienzo no recorta nada. Ese
      // sobrante caía fuera de la caja que borra el degradado y se quedaba
      // clavado para siempre: la franja del borde derecho que se reportó.
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, w, h);
      ctx.clip();
      ctx.drawImage(foto, ox + cover.x, oy + cover.y, cover.w, cover.h);

      if (p > 0) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = degradado(frente, vuelo.eje);
        ctx.fillRect(ox, oy, w, h);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    }

    // LOS GRANOS. Solo los que están en el aire; el resto o no han despegado —y
    // ahí está la foto— o ya se fueron. Eso es lo que mantiene el coste plano por
    // muchos granos que haya declarados.
    let cuboActual = -1;
    for (let n = 0; n < total; n++) {
      const t = vueloDeGrano(frente, vuelo.turno[n]);
      if (t <= 0 || t >= 1) continue;

      // Se apaga al alejarse. En casa vale 1: ahí el grano ES su píxel de la
      // foto, y es lo que hace que la nube reconstruya la imagen al aterrizar.
      ctx.globalAlpha = Math.pow(1 - t, 0.75);
      // Acelera al irse (y frena al llegar, que es el mismo recorrido al revés) y
      // encoge por el camino: de tesela a grano de arena.
      const v = t * t;
      const s = lado * (1 - receta.encoge * t);
      const cx = hx[n] + vuelo.dx[n] * v;
      const cy = hy[n] + vuelo.dy[n] * v;

      if (receta.trozo) {
        // Cuadrados grandes: llevan su recorte real de la foto y giran. Son unos
        // cientos, así que un `save`/`rotate`/`restore` por pieza sale gratis.
        const i = celda[n];
        const c = i % cols;
        const f = (i - c) / cols;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(vuelo.giro[n] * t);
        ctx.drawImage(
          foto,
          (c * celdaW - cover.x) * aFuenteX,
          (f * celdaH - cover.y) * aFuenteY,
          celdaW * aFuenteX,
          celdaH * aFuenteY,
          -s / 2,
          -s / 2,
          s,
          s,
        );
        ctx.restore();
        continue;
      }

      const cubo = cubos[n];
      if (cubo !== cuboActual) {
        cuboActual = cubo;
        ctx.fillStyle = estilos.get(cubo)!;
      }
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  };

  // Estado inicial: la foto todavía no ha llegado a su sitio en la secuencia.
  pintar(1, true);

  return {
    pintar,
    destruir() {
      capa.textContent = "";
      delete capa.dataset.listo;
    },
  };
}

