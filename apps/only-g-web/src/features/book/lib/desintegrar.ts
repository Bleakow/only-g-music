/**
 * EL DESINTEGRADO de la foto de portada — ARENA, no cascotes.
 *
 * La primera versión partía la foto en teselas y las hacía volar. Se veía lo que
 * era: pedazos de cuadrado desarmándose. Lo que pedía el brief es otra cosa —
 * partículas diminutas, como arena que se lleva el viento— y eso no es el mismo
 * efecto con las piezas más pequeñas: teselas de dos píxeles serían decenas de
 * miles de nodos del DOM, que ningún móvil aguanta.
 *
 * ASÍ QUE ESTO ES UN LIENZO, y son dos capas dibujadas en el mismo sitio:
 *
 *  1. LA FOTO SE EROSIONA. Se dibuja entera y luego se BORRA con un degradado
 *     diagonal de banda ancha que barre en la dirección del viento
 *     (`destination-out`). No es un desvanecido: es un frente que avanza, y por
 *     eso se lee como algo que se deshace por un lado en vez de como algo que se
 *     apaga.
 *  2. EL POLVO. Miles de granos de uno o dos píxeles que salen JUSTO DEL FRENTE
 *     —su retardo se calcula con la misma proyección que usa el degradado— y se
 *     van de lado subiendo. Ese acoplamiento es lo que hace que el polvo parezca
 *     salir de la foto y no espolvorearse por encima.
 *
 * DETERMINISTA, como la versión de teselas y por el mismo motivo: va atado al
 * SCROLL, y un scroll se recorre en los dos sentidos. Con `Math.random()` la foto
 * se re-desperdigaría distinta al volver a subir. Cada grano deriva su sitio, su
 * viaje y su retardo de su índice.
 *
 * LA TRAMPA QUE RESUELVE ESTE MÓDULO SIGUE SIENDO LA URL. `next/image` no sirve
 * el archivo original sino una variante optimizada por `/_next/image`, así que
 * apuntar a la url de Storage descargaría la foto DOS VECES. Se lee `currentSrc`
 * de la imagen que ya está en la página: mismo recurso, cero bytes de más — y de
 * paso mismo origen, que es lo que permite leer sus píxeles.
 */

/** Granos. Más en pantalla grande; el móvil no necesita tantos para leerse. */
const GRANOS_ESTRECHO = 2200;
const GRANOS_ANCHO = 4200;

/** Ancho del lienzo de MUESTREO. Solo sirve para sacar colores de polvo. */
const MUESTRA = 220;

/** Resolución máxima del lienzo. Más allá no se distingue y cuesta el doble. */
const DPR_MAX = 1.75;

/**
 * SITIO PARA VOLAR. El lienzo se sale del marco de la foto —a la derecha y hacia
 * arriba, que es a donde va el viento— porque si no el polvo se estrellaría
 * contra su propio borde: un lienzo recorta lo que se dibuja fuera, así que la
 * arena desaparecería de golpe en una línea recta invisible. Se lee como si
 * chocara con un cristal.
 *
 * No hace falta cubrir el viaje ENTERO: el grano se apaga por el camino, así que
 * basta con llegar hasta donde todavía se ve.
 */
const VUELO_X = 0.75;
const VUELO_Y = 0.45;

/**
 * Ancho de la banda del frente, en fracción del recorrido. Es lo que separa
 * "algo que se deshace" de "una cortina que pasa": con la banda estrecha se ve
 * el borde recto del degradado.
 */
const BANDA = 0.42;

/**
 * Ruido determinista a partir de un entero. Mismo motivo que en la versión de
 * teselas: con azar de verdad el desintegrado no se podría rebobinar.
 */
function ruido(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

interface Grano {
  /** Casa, en píxeles del lienzo. */
  hx: number;
  hy: number;
  /** Viaje completo, en píxeles del lienzo. */
  dx: number;
  dy: number;
  /** 0..1 sobre el eje del viento: cuándo le toca salir. */
  u: number;
  /** Lado del grano, en píxeles del lienzo. */
  s: number;
  /** Color ya cuantizado. Los granos van ORDENADOS por este número. */
  cubo: number;
}

export interface Polvo {
  /**
   * Pinta el estado. `0` = foto entera y quieta, `1` = ya no queda nada.
   * Se llama desde el `onUpdate` de una timeline con `scrub`.
   */
  pintar(progreso: number): void;
  destruir(): void;
}

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
 * recortada, así que sin esto el polvo saldría de una foto ENCUADRADA DISTINTA a
 * la que el visitante estaba viendo. Es la clase de desajuste que se nota sin
 * saber decir por qué.
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

/**
 * Monta el lienzo de polvo dentro de `capa`, del tamaño de `marco`, con la foto
 * que `img` está enseñando. Devuelve `null` si algo falla — y entonces se queda
 * la foto del DOM, que es una foto perfecta. El desintegrado es un adorno; la
 * foto, no.
 */
export async function construirPolvo(
  marco: HTMLElement,
  capa: HTMLElement,
  img: HTMLImageElement,
  url: string,
): Promise<Polvo | null> {
  const anchoCss = marco.clientWidth;
  const altoCss = marco.clientHeight;
  if (!anchoCss || !altoCss) return null;

  const foto = await cargar(url);
  if (!foto || !foto.naturalWidth) return null;

  const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
  // `w`/`h` son la caja de LA FOTO; el lienzo es más grande y la foto vive
  // dentro, desplazada hacia abajo lo que se reserva para volar hacia arriba.
  const w = Math.round(anchoCss * dpr);
  const h = Math.round(altoCss * dpr);
  const oy = Math.round(h * VUELO_Y);

  const lienzo = document.createElement("canvas");
  lienzo.className = "og-book-desint-lienzo";
  lienzo.width = Math.round(w * (1 + VUELO_X));
  lienzo.height = h + oy;
  // La caja del lienzo se mide desde la de la foto, así que el marco sigue
  // mandando y el CSS no tiene que saber nada de estos márgenes.
  lienzo.style.top = `${-VUELO_Y * 100}%`;
  lienzo.style.width = `${(1 + VUELO_X) * 100}%`;
  lienzo.style.height = `${(1 + VUELO_Y) * 100}%`;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;

  const [fx, fy] = anclaDe(img);
  const cover = recorteCover(foto.naturalWidth, foto.naturalHeight, w, h, fx, fy);

  // ── Colores del polvo ─────────────────────────────────────────────────────
  // Se muestrean de una copia PEQUEÑA de la foto: para granos de dos píxeles no
  // hace falta más, y leer los píxeles del lienzo grande costaría megabytes.
  const mh = Math.max(1, Math.round((MUESTRA * altoCss) / anchoCss));
  const mini = document.createElement("canvas");
  mini.width = MUESTRA;
  mini.height = mh;
  const mctx = mini.getContext("2d", { willReadFrequently: true });
  if (!mctx) return null;
  const coverMini = recorteCover(
    foto.naturalWidth,
    foto.naturalHeight,
    MUESTRA,
    mh,
    fx,
    fy,
  );
  mctx.drawImage(foto, coverMini.x, coverMini.y, coverMini.w, coverMini.h);

  let pixeles: Uint8ClampedArray;
  try {
    pixeles = mctx.getImageData(0, 0, MUESTRA, mh).data;
  } catch {
    // Lienzo contaminado (una pieza de otro dominio sin CORS). Sin colores no
    // hay polvo, y una foto entera es mejor que un efecto a medias.
    return null;
  }

  // ── Los granos ────────────────────────────────────────────────────────────
  const total = anchoCss < 300 ? GRANOS_ESTRECHO : GRANOS_ANCHO;
  const granos: Grano[] = [];
  const estilos = new Map<number, string>();

  /**
   * El eje del frente va de la esquina de ABAJO-IZQUIERDA a la de ARRIBA-DERECHA,
   * o sea en la dirección del viento. Este denominador es lo que convierte una
   * posición del lienzo en su sitio 0..1 sobre ese eje, y sale de despejar la
   * fórmula del degradado lineal — de ahí que sea exacto y no un apaño.
   */
  const diagonal = w * w + h * h;

  for (let i = 0; i < total; i++) {
    const nx = ruido(i);
    const ny = ruido(i + 7919);

    const px = Math.min(MUESTRA - 1, Math.floor(nx * MUESTRA));
    const py = Math.min(mh - 1, Math.floor(ny * mh));
    const k = (py * MUESTRA + px) * 4;
    // Tres bits por canal. El polvo no necesita fidelidad de color y cuantizar
    // agrupa los granos en pocas decenas de cubos: dibujar ordenado por cubo
    // convierte miles de cambios de `fillStyle` —que se parsean como texto y son
    // lo caro de un lienzo— en unas pocas decenas por fotograma.
    const r = pixeles[k] & 0xe0;
    const g = pixeles[k + 1] & 0xe0;
    const b = pixeles[k + 2] & 0xe0;
    const cubo = (r << 16) | (g << 8) | b;
    if (!estilos.has(cubo)) estilos.set(cubo, `rgb(${r} ${g} ${b})`);

    // El viento va hacia el lado y hacia arriba, con turbulencia por grano: sin
    // ella los granos viajarían en haces paralelos y se leería como un barrido.
    const empuje = 0.45 + ruido(i + 104729) * 0.95;
    const desvio = (ruido(i + 15485863) - 0.5) * 0.55;

    granos.push({
      hx: nx * w,
      hy: oy + ny * h,
      dx: empuje * w,
      dy: (-0.34 * empuje + desvio) * h,
      // Dónde cae este grano sobre el EJE DEL FRENTE, y la cuenta es la del
      // degradado despejada, no una diagonal parecida. Es lo único que hace que
      // el polvo salga del borde que se está deshaciendo en vez de espolvorearse
      // por toda la foto: si las dos proyecciones no son la MISMA, el polvo
      // adelanta o retrasa al frente y se ve que son dos efectos pegados.
      u: (nx * w * w + (1 - ny) * h * h) / diagonal,
      s: (1 + ruido(i + 32452843) * 1.6) * dpr,
      cubo,
    });
  }

  // Ordenar UNA vez para poder dibujar por cubos en cada fotograma.
  granos.sort((a, b) => a.cubo - b.cubo);

  capa.textContent = "";
  capa.appendChild(lienzo);
  capa.dataset.listo = "si";

  /**
   * El degradado que borra la parte ya convertida en polvo. Sus dos extremos se
   * calculan con la MISMA función que decide la vida de cada grano, y los topes
   * van en el alfa de los extremos y no clavando paradas en 0 y 1: con el frente
   * todavía fuera del lienzo, una parada opaca en 0 borraría de golpe la esquina
   * entera en el primer fotograma.
   */
  const degradado = (p: number): CanvasGradient => {
    const frente = p * (1 + BANDA) - BANDA;
    const borrado = (s: number) =>
      Math.min(1, Math.max(0, (frente + BANDA - s) / BANDA));
    const g = ctx.createLinearGradient(0, oy + h, w, oy);
    g.addColorStop(0, `rgba(0,0,0,${borrado(0)})`);
    if (frente > 0 && frente < 1) g.addColorStop(frente, "rgba(0,0,0,1)");
    const fin = frente + BANDA;
    if (fin > 0 && fin < 1) g.addColorStop(fin, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${borrado(1)})`);
    return g;
  };

  // Función FLECHA y no declaración: TypeScript no aplica el estrechamiento del
  // `if (!ctx) return null` de arriba dentro de una `function` —está izada, así
  // que podría llamarse antes—, y quedaría un archivo lleno de `ctx!`.
  const pintar = (progreso: number): void => {
    const p = Math.min(1, Math.max(0, progreso));
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);

    if (p < 1) {
      ctx.globalAlpha = 1;
      ctx.drawImage(foto, cover.x, cover.y + oy, cover.w, cover.h);

      if (p > 0) {
        // SE BORRA lo que ya se volvió polvo. El frente barre de `-BANDA` a `1`:
        // al empezar, su borde de salida está justo en el origen (nada borrado);
        // al terminar, su borde de entrada ha pasado el final (nada intacto).
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = degradado(p);
        // Solo sobre la caja de la foto: fuera de ella no hay nada que borrar y
        // el degradado, extendido, se comería el polvo que ya voló.
        ctx.fillRect(0, oy, w, h);
        ctx.globalCompositeOperation = "source-over";
      }
    }

    // EL POLVO. Cada grano vive EXACTAMENTE lo que la banda del frente tarda en
    // cruzarlo — `borrado(u)` es la misma cuenta que decide cuánta foto queda en
    // ese punto—, así que el grano nace justo cuando su trozo de foto empieza a
    // desaparecer. Fuera de su ventana no se dibuja: eso mantiene el coste plano
    // por muchos granos que haya declarados.
    const frente = p * (1 + BANDA) - BANDA;
    let cuboActual = -1;
    for (let i = 0; i < granos.length; i++) {
      const gr = granos[i];
      const t = (frente + BANDA - gr.u) / BANDA;
      if (t <= 0 || t >= 1) continue;

      if (gr.cubo !== cuboActual) {
        cuboActual = gr.cubo;
        ctx.fillStyle = estilos.get(gr.cubo)!;
      }
      // Sube y baja: aparece al despegar y se apaga al alejarse. Un grano que se
      // corta de golpe al final del viaje se ve como un parpadeo.
      ctx.globalAlpha = Math.sin(Math.PI * t) * 0.85;
      // Acelera: al principio se despega despacio y luego el viento se lo lleva.
      const v = t * t;
      ctx.fillRect(gr.hx + gr.dx * v, gr.hy + gr.dy * v, gr.s, gr.s);
    }
    ctx.globalAlpha = 1;
  };

  // Estado inicial: la foto todavía no ha llegado a su sitio en la secuencia.
  pintar(1);

  return {
    pintar,
    destruir() {
      capa.textContent = "";
      delete capa.dataset.listo;
    },
  };
}

/**
 * La forma del desintegrado a lo largo de su tramo: SE ARMA, se queda quieta, SE
 * DESHACE. Devuelve cuánto polvo hay (0 = foto entera).
 *
 * Va en UNA función pura y la mueve UNA sola tween, y esto no es estilo: con dos
 * tweens —una para armar y otra para deshacer— cada una se aparca en su valor de
 * inicio o de fin cuando el scroll está fuera de su tramo, y la de deshacer
 * estaría escribiendo "foto entera" durante toda la fase de armado. El resultado
 * es que la foto aparece de golpe antes de tiempo, y solo a veces.
 */
export function fasePolvo(t: number): number {
  // Los extremos se devuelven a mano y no salen de la cuenta: `1 - 0.66` no da
  // `0.34` en coma flotante, así que la división terminaba en 0.999… y el último
  // fotograma dejaba un rastro de foto que no se iba nunca.
  if (t <= 0 || t >= 1) return 1;
  if (t < FIN_ARMADO) return 1 - t / FIN_ARMADO;
  if (t < FIN_QUIETO) return 0;
  return Math.min(1, (t - FIN_QUIETO) / (1 - FIN_QUIETO));
}

/** Hasta aquí la foto se está armando. */
const FIN_ARMADO = 0.46;
/**
 * Y de `FIN_ARMADO` hasta aquí NO PASA NADA: la foto está entera y quieta. Ese
 * silencio es lo único que la convierte en una foto que se mira en vez de en un
 * efecto que se ve pasar, y es el único tramo del recorrido que no se recorta.
 */
const FIN_QUIETO = 0.66;
