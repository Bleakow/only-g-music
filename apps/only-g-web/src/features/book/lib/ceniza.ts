import { frenteDePolvo, vueloDeGrano, type Polvo } from "./desintegrar";

/**
 * CENIZA — el desintegrado a resolución de PÍXEL.
 *
 * Es la técnica del pen de `dev_loop` que pasó el usuario, adaptada. La idea que
 * la hace posible, y que no se me había ocurrido, es de las buenas:
 *
 *   NO SE MUEVE UN PÍXEL A LA VEZ, SE MUEVEN GRUPOS DE PÍXELES.
 *
 * La foto se reparte en un puñado de CAPAS; cada píxel va a una capa elegida por
 * su columna más un poco de azar, así que cada capa se queda con un tamiz fino
 * de la imagen dentro de una franja vertical. Luego se mueve la capa ENTERA —un
 * `drawImage` con su desplazamiento, su giro y su transparencia— en vez de sus
 * cientos de miles de píxeles. Veinticuatro dibujos por fotograma en lugar de
 * doscientos mil.
 *
 * Eso es exactamente lo que el motor de rejilla (`desintegrar.ts`) NO puede
 * hacer: allí cada grano se dibuja por su cuenta, así que el grano no puede bajar
 * de tres píxeles sin arruinar los fotogramas. Aquí el grano ES el píxel.
 *
 * QUÉ CAMBIA RESPECTO AL ORIGINAL, y por qué:
 *
 *  · Va atado al SCROLL, no al tiempo, y el scroll se recorre en los dos
 *    sentidos: nada de `Math.random()` en el movimiento. Cada capa deriva su
 *    ángulo y su giro de su índice.
 *  · Las capas se recortan a SU FRANJA en vez de ocupar la foto entera. En el
 *    pen son 75 lienzos del tamaño completo, que para una portada de móvil serían
 *    más de cien megabytes de memoria de vídeo. Como el reparto por columna ya
 *    encierra cada capa en media anchura, guardar el resto es guardar
 *    transparencia.
 *  · No hay foto de fondo debajo. No hace falta: con todas las capas en su sitio
 *    la suma ES la foto, píxel a píxel. Es la versión más literal de "las
 *    partículas son la imagen".
 */

/**
 * Cuántas capas. Es el mando de todo: más capas dan un deshecho más continuo y
 * cuestan más memoria y más dibujos. El pen usa 75 sobre un lienzo de 600×400;
 * aquí hay que ser más prudente porque esto se abre en móviles.
 */
const CAPAS = 24;

/**
 * Resolución. Más baja que la del motor de rejilla a propósito: aquí se guardan
 * VEINTICUATRO lienzos, así que cada punto de más se paga veinticuatro veces.
 */
const DPR_MAX = 1.25;

/**
 * Reparto de un píxel a su capa: `(azar + 2·columna/ancho) / 3`.
 *
 * Es la fórmula del pen y merece la pena entenderla porque es más lista de lo
 * que parece. La columna manda —el deshecho barre de izquierda a derecha— pero
 * un tercio del resultado es azar, así que las capas se solapan: cada una se
 * lleva un tamiz de píxeles sueltos de una franja de media anchura, en vez de una
 * banda maciza. Por eso al irse una capa no se abre un boquete con forma de
 * columna, sino que la foto se agujerea de forma pareja.
 *
 * Es el mismo remedio que `DISPERSION` en el motor de rejilla, encontrado por
 * otro camino.
 */
const AZAR = 1 / 3;

/** Ruido determinista. Mismo motivo que en el otro motor: hay que rebobinar. */
function ruido(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Lo que vuela una capa entera: sitio, giro y opacidad, todo en función de `t`. */
interface Deriva {
  dx: number;
  dy: number;
  giro: number;
}

/**
 * Los dos vuelos. Como en el otro motor, la salida NO puede ser la entrada
 * rebobinada.
 *
 *  · llega — las capas bajan desde arriba, casi sin girar. Ceniza que se posa.
 *  · se va — se abren hacia los lados girando, como una baraja que se suelta.
 */
function derivaLlegada(i: number, w: number, h: number): Deriva {
  return {
    dx: (ruido(i + 104729) - 0.5) * 0.1 * w,
    dy: -(0.12 + ruido(i + 15485863) * 0.1) * h,
    giro: (ruido(i + 32452843) - 0.5) * 0.06,
  };
}

function derivaSalida(i: number, w: number, h: number): Deriva {
  // El ángulo se abre en abanico con el índice, no al azar: así las capas salen
  // ordenadas de un lado al otro en vez de en todas direcciones a la vez, y el
  // deshecho conserva el barrido que ya tiene el reparto por columnas.
  const angulo = (i / CAPAS - 0.5) * 2.2 + (ruido(i + 217645177) - 0.5) * 0.5;
  const alcance = 0.1 + ruido(i + 6700417) * 0.12;
  return {
    dx: Math.cos(angulo) * alcance * w,
    dy: Math.sin(angulo) * alcance * h - 0.06 * h,
    giro: (ruido(i + 179424673) - 0.5) * 0.5,
  };
}

interface Capa {
  lienzo: HTMLCanvasElement;
  /** Esquina de la franja dentro de la foto, en píxeles del lienzo. */
  x: number;
  y: number;
}

/**
 * Monta la ceniza. Devuelve `null` si algo falla, y entonces se queda la foto del
 * DOM — que es una foto perfecta.
 *
 * `dibujarFoto` la pinta ya recortada como la enseñaba el DOM: el recorte de
 * `object-fit: cover` lo resuelve quien llama, porque es el mismo cálculo que
 * necesita el otro motor y no tiene por qué vivir dos veces.
 */
export function construirCeniza(
  capaHost: HTMLElement,
  anchoCss: number,
  altoCss: number,
  dibujarFoto: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): Polvo | null {
  const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
  const w = Math.round(anchoCss * dpr);
  const h = Math.round(altoCss * dpr);
  if (!w || !h) return null;

  // ── La foto, una vez ──────────────────────────────────────────────────────
  const fuente = document.createElement("canvas");
  fuente.width = w;
  fuente.height = h;
  const fctx = fuente.getContext("2d", { willReadFrequently: true });
  if (!fctx) return null;
  dibujarFoto(fctx, w, h);

  let pixeles: Uint8ClampedArray;
  try {
    pixeles = fctx.getImageData(0, 0, w, h).data;
  } catch {
    // Lienzo contaminado (una pieza de otro dominio sin CORS).
    return null;
  }

  // ── A qué capa va cada píxel ──────────────────────────────────────────────
  // Se calcula ANTES de reservar memoria para saber la franja real de cada capa:
  // reservar el lienzo entero por capa serían más de cien megabytes en una
  // portada de escritorio, y casi todo transparente.
  const deQuien = new Uint8Array(w * h);
  const x0 = new Int32Array(CAPAS).fill(w);
  const x1 = new Int32Array(CAPAS).fill(-1);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = y * w + x;
      const i = Math.min(
        CAPAS - 1,
        Math.floor(CAPAS * (ruido(n) * AZAR + ((1 - AZAR) * 2 * x) / w) * 0.75),
      );
      deQuien[n] = i;
      if (x < x0[i]) x0[i] = x;
      if (x > x1[i]) x1[i] = x;
    }
  }

  // ── Una capa por grupo, recortada a su franja ─────────────────────────────
  const capas: Capa[] = [];
  const buffers: ImageData[] = [];
  for (let i = 0; i < CAPAS; i++) {
    const ancho = Math.max(1, x1[i] - x0[i] + 1);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = h;
    const c = lienzo.getContext("2d");
    if (!c) return null;
    capas.push({ lienzo, x: x0[i] === w ? 0 : x0[i], y: 0 });
    buffers.push(c.createImageData(ancho, h));
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = y * w + x;
      const i = deQuien[n];
      const buf = buffers[i];
      const k = (y * capas[i].lienzo.width + (x - capas[i].x)) * 4;
      const o = n * 4;
      buf.data[k] = pixeles[o];
      buf.data[k + 1] = pixeles[o + 1];
      buf.data[k + 2] = pixeles[o + 2];
      buf.data[k + 3] = pixeles[o + 3];
    }
  }

  for (let i = 0; i < CAPAS; i++) {
    capas[i].lienzo.getContext("2d")!.putImageData(buffers[i], 0, 0);
  }

  // ── El lienzo visible ─────────────────────────────────────────────────────
  // Un margen holgado por los cuatro lados: las capas se abren en abanico, y un
  // lienzo recorta lo que se dibuja fuera.
  const margen = 0.35;
  const ox = Math.round(w * margen);
  const oy = Math.round(h * margen);
  const lienzo = document.createElement("canvas");
  lienzo.className = "og-book-desint-lienzo";
  lienzo.width = w + ox * 2;
  lienzo.height = h + oy * 2;
  lienzo.style.left = `${-margen * 100}%`;
  lienzo.style.top = `${-margen * 100}%`;
  lienzo.style.width = `${(1 + margen * 2) * 100}%`;
  lienzo.style.height = `${(1 + margen * 2) * 100}%`;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;

  capaHost.textContent = "";
  capaHost.appendChild(lienzo);
  capaHost.dataset.listo = "si";

  const pintar = (progreso: number, armando: boolean): void => {
    const p = Math.min(1, Math.max(0, progreso));
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    const frente = frenteDePolvo(p);

    for (let i = 0; i < CAPAS; i++) {
      // El turno de una capa es su índice, y ahí NO hace falta desordenar nada:
      // el desorden ya está dentro, en el reparto de píxeles. Dos capas seguidas
      // llevan tamices entremezclados de la misma zona.
      const bruto = vueloDeGrano(frente, i / (CAPAS - 1));
      if (bruto >= 1) continue;
      // Se recorta por abajo y no se descarta: una capa que aún no ha despegado
      // tiene que dibujarse EN SU SITIO, porque entre todas son la foto. Este es
      // el motivo por el que aquí no hace falta pintar la foto debajo.
      const t = Math.max(0, bruto);
      const d = armando
        ? derivaLlegada(i, w, h)
        : derivaSalida(i, w, h);

      const capa = capas[i];
      const cx = ox + capa.x + capa.lienzo.width / 2 + d.dx * t;
      const cy = oy + capa.y + h / 2 + d.dy * t;

      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.translate(cx, cy);
      ctx.rotate(d.giro * t);
      ctx.drawImage(capa.lienzo, -capa.lienzo.width / 2, -h / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  pintar(1, true);

  return {
    pintar,
    destruir() {
      capaHost.textContent = "";
      delete capaHost.dataset.listo;
      // Los lienzos fuera de pantalla no los recoge nadie mientras el array viva:
      // se vacían a 0×0 para soltar su memoria de vídeo ya, sin esperar al GC.
      for (const c of capas) {
        c.lienzo.width = 0;
        c.lienzo.height = 0;
      }
      capas.length = 0;
    },
  };
}
