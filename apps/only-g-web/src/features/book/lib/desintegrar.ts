/**
 * EL DESINTEGRADO de la foto de portada — LAS PARTÍCULAS SON LA FOTO.
 *
 * Han hecho falta tres intentos y los dos primeros fallaban por la misma razón
 * de fondo, así que conviene dejarla escrita.
 *
 *  · v1: teselas del DOM. Se veía lo que era, pedazos de cuadrado.
 *  · v2: un lienzo con la foto erosionándose y una NUBE de polvo encima. Mejor,
 *    pero se reportó dos veces "la foto se revela antes de que lleguen las
 *    partículas" — y no era cuestión de afinar el retardo: eran DOS EFECTOS
 *    PEGADOS. Una foto que se aclaraba por su cuenta y, aparte, arena volando.
 *    Por mucho que se sincronicen, el ojo separa lo que no está hecho de lo
 *    mismo.
 *
 * De ahí esta versión: CADA PARTÍCULA LLEVA SU PÍXEL. Se muestrea la foto en una
 * rejilla fina y sale un grano por celda con el color de esa celda; en reposo los
 * granos tesela con tesela RECONSTRUYEN la imagen, y al volar se dispersan, se
 * encogen y se apagan. Ya no hay una foto por un lado y polvo por otro: lo que se
 * ve armarse es literalmente la nube de granos.
 *
 * La foto de verdad SÍ se dibuja, debajo, y se borra por delante de los granos
 * con un degradado. Pero su papel cambia: ya no es lo que se revela, es lo que
 * RELLENA los huecos entre granos una vez han aterrizado, para que la foto quieta
 * tenga calidad de foto y no de mosaico. Por eso su banda va en el PRIMER tramo
 * del vuelo (ver `FOTO_TRAS_POLVO`): al revés —armando— no termina de cerrarse
 * hasta que el grano ya está en su sitio.
 *
 * DETERMINISTA, y no es un detalle: esto va atado al SCROLL y un scroll se
 * recorre en los dos sentidos. Con `Math.random()` la foto se re-desperdigaría
 * distinta al volver a subir. El sitio de cada grano sale de su celda y su viaje,
 * de un hash de su índice.
 *
 * LA TRAMPA DE LA URL. `next/image` no sirve el archivo original sino una
 * variante optimizada por `/_next/image`, así que apuntar a la url de Storage
 * descargaría la foto DOS VECES. Se lee `currentSrc` de la imagen que ya está en
 * la página: mismo recurso, cero bytes de más — y de paso mismo origen, que es lo
 * que permite leer sus píxeles.
 */

/**
 * Lado de la celda en píxeles de CSS. Es el compromiso del efecto entero: más
 * fino se parece más a la foto y cuesta más, más grueso se parece a un mosaico.
 * A 3.4 los granos son diminutos en pantalla y en vuelo se leen como arena.
 */
const PASO_CSS = 3.4;

/**
 * Tope duro de granos. Por encima de esto el paso se ensancha solo.
 *
 * Lo que de verdad cuesta es `BANDA` por esto —los que están en el aire a la vez,
 * unos 5.800 en escritorio—, y ese es el número que hay que tocar si algún día
 * esto va justo de fotogramas. Un book abierto en un monitor de 27" no puede
 * pedir el triple de granos que uno abierto en un móvil solo porque hay sitio.
 */
const GRANOS_MAX = 17000;

/** Resolución máxima del lienzo. Más allá no se distingue y cuesta el doble. */
const DPR_MAX = 1.75;

/**
 * SITIO PARA VOLAR. El lienzo se sale del marco de la foto —a la derecha y hacia
 * arriba, que es a donde va el viento— porque si no el polvo se estrellaría
 * contra su propio borde: un lienzo recorta lo que se dibuja fuera, así que la
 * arena desaparecería de golpe en una línea recta invisible. Se lee como si
 * chocara con un cristal.
 */
const VUELO_X = 0.75;
const VUELO_Y = 0.45;

/**
 * Ancho de la banda del frente, en fracción del recorrido: cuánto dura el vuelo
 * de un grano. Es también la fracción de granos que están en el aire a la vez, o
 * sea lo que de verdad cuesta cada fotograma.
 */
const BANDA = 0.34;

/**
 * QUÉ PARTE DEL VUELO DE UN GRANO OCUPA LA DESAPARICIÓN DE SU TROZO DE FOTO.
 *
 * Esto es lo que se reportó dos veces y estrechar la banda no lo arreglaba,
 * porque el problema no era su ancho sino DÓNDE estaba puesta.
 *
 * Piénsalo al revés, que es como se ve armándose: el grano viaja de fuera hacia
 * su casa. Si la foto se cierra durante el ÚLTIMO tramo de ese viaje —cuando el
 * grano todavía está a media distancia— la foto termina ANTES de que la arena
 * aterrice, que es exactamente lo que se veía. Puesta en el PRIMER tramo, al
 * derecho la foto se va nada más despegar el grano y al revés no acaba de
 * cerrarse hasta que el grano ya está en su sitio.
 *
 * Y deja un margen a cada extremo del recorrido en el que solo hay arena y
 * ninguna foto. Ese margen ES el efecto: empieza con polvo que se junta y termina
 * con polvo que se va.
 */
const FOTO_TRAS_POLVO = 0.5;

/** Cuánto encoge un grano al final de su vuelo. De tesela a arena. */
const ENCOGE = 0.55;

/**
 * CUÁNTO SE DESORDENA EL TURNO DE CADA GRANO respecto al de su sitio.
 *
 * Sin esto el frente es una LÍNEA RECTA: todos los granos de una diagonal salen
 * a la vez y llegan a la vez. Se reportó tal cual — "la figura ya está ahí y aún
 * faltan partículas por llegar": la esquina de abajo quedaba como una cuña
 * perfectamente recortada, todavía en granos, mientras el resto de la foto ya
 * estaba entera. Y una cuña de borde recto no se lee como arena, se lee como
 * algo a medio cargar.
 *
 * Con el turno desordenado, el sitio sigue mandando —la dirección del barrido se
 * conserva— pero los vecinos ya no van a una: el borde se convierte en una franja
 * ancha y granulada donde unos ya se fueron y otros siguen puestos. Que es como
 * se deshace algo de verdad.
 *
 * El reparto `u·(1-D) + D·ruido` mantiene el turno dentro de 0..1 sin recortar
 * nada, y eso importa: un turno por encima de 1 dejaría granos en el aire al
 * final del recorrido, cuando ya no debería quedar ni uno.
 */
const DISPERSION = 0.3;

/**
 * Ruido determinista a partir de un entero. Con azar de verdad el desintegrado no
 * se podría rebobinar, y esta secuencia se recorre en los dos sentidos.
 */
function ruido(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// El reloj del desintegrado
//
// Estas tres cuentas son las que reparten el turno de cada grano y las que dicen
// dónde está el frente. Salen del lienzo a propósito: son aritmética pura, se
// pueden comprobar sin navegador, y de ellas depende una invariante que falla
// CALLANDO — que al principio y al final del recorrido no quede ni un grano en
// el aire. Un grano con el turno fuera de 0..1 se queda flotando para siempre en
// una foto que ya está entera, y no hay error que lo delate.
// ─────────────────────────────────────────────────────────────────────────────

/** Dónde está el frente para un progreso dado (`0` = foto entera, `1` = nada). */
export function frenteDePolvo(p: number): number {
  return p * (1 + BANDA) - BANDA;
}

/**
 * El turno de un grano: su sitio sobre el eje del viento, desordenado. El reparto
 * mantiene el resultado dentro de 0..1 sin recortar nada, que es lo que garantiza
 * la invariante de arriba.
 */
export function turnoDeGrano(sitio: number, azar: number): number {
  return sitio * (1 - DISPERSION) + DISPERSION * azar;
}

/** Su vuelo: `0` = en casa (es su píxel de la foto), `1` = ya no se ve. */
export function vueloDeGrano(frente: number, turno: number): number {
  return (frente + BANDA - turno) / BANDA;
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

/**
 * Monta el lienzo dentro de `capa`, del tamaño de `marco`, con la foto que `img`
 * está enseñando. Devuelve `null` si algo falla — y entonces se queda la foto del
 * DOM, que es una foto perfecta. El desintegrado es un adorno; la foto, no.
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

  // ── La rejilla ────────────────────────────────────────────────────────────
  // El paso se ensancha solo si la foto es tan grande que se pasaría del tope.
  // Un book abierto en un monitor de 27" no puede pedir el triple de granos que
  // uno abierto en un móvil solo porque hay sitio.
  const paso = Math.max(
    PASO_CSS,
    Math.sqrt((anchoCss * altoCss) / GRANOS_MAX),
  );
  const cols = Math.max(16, Math.round(anchoCss / paso));
  const filas = Math.max(16, Math.round(altoCss / paso));
  const total = cols * filas;

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
  const dx = new Float32Array(total);
  const dy = new Float32Array(total);
  const uu = new Float32Array(total);
  const cubos = new Uint32Array(total);
  const estilos = new Map<number, string>();

  const celdaW = w / cols;
  const celdaH = h / filas;
  /**
   * El eje del frente va de la esquina de ABAJO-IZQUIERDA a la de ARRIBA-DERECHA,
   * o sea en la dirección del viento. Este denominador convierte una posición del
   * lienzo en su sitio 0..1 sobre ese eje, y sale de despejar la fórmula del
   * degradado lineal — de ahí que sea exacto y no un apaño.
   */
  const diagonal = w * w + h * h;

  const orden = new Uint32Array(total);
  for (let i = 0; i < total; i++) orden[i] = i;

  const cubosSinOrdenar = new Uint32Array(total);
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const i = f * cols + c;
      const k = i * 4;
      // Tres bits por canal. Cuantizar agrupa los granos en pocas decenas de
      // cubos, y dibujar ORDENADO por cubo convierte miles de cambios de
      // `fillStyle` —que se parsean como texto y son lo caro de un lienzo— en
      // unas pocas decenas por fotograma.
      const r = pixeles[k] & 0xe0;
      const g = pixeles[k + 1] & 0xe0;
      const b = pixeles[k + 2] & 0xe0;
      const cubo = (r << 16) | (g << 8) | b;
      if (!estilos.has(cubo)) estilos.set(cubo, `rgb(${r} ${g} ${b})`);
      cubosSinOrdenar[i] = cubo;
    }
  }

  // Ordenar UNA vez, al montar. Después el bucle de pintado ya sale barato.
  const ordenados = Array.from(orden).sort(
    (a, b) => cubosSinOrdenar[a] - cubosSinOrdenar[b],
  );

  for (let n = 0; n < total; n++) {
    const i = ordenados[n];
    const c = i % cols;
    const f = (i - c) / cols;

    // El viento va hacia el lado y hacia arriba, con turbulencia POR GRANO: sin
    // ella la rejilla viajaría en bloque y se leería como un mosaico que se
    // desliza, no como arena que se dispersa.
    const empuje = 0.4 + ruido(i) * 0.95;
    const desvio = (ruido(i + 15485863) - 0.5) * 0.6;

    // Su sitio sobre el eje del viento: la cuenta del degradado despejada, no una
    // diagonal parecida.
    const sitio =
      (((c + 0.5) / cols) * w * w + (1 - (f + 0.5) / filas) * h * h) / diagonal;

    hx[n] = (c + 0.5) * celdaW;
    hy[n] = oy + (f + 0.5) * celdaH;
    dx[n] = empuje * w;
    dy[n] = (-0.34 * empuje + desvio) * h;
    // El turno: el sitio manda, pero desordenado. Ver `DISPERSION`.
    uu[n] = turnoDeGrano(sitio, ruido(i + 2971215073));
    cubos[n] = cubosSinOrdenar[i];
  }

  capa.textContent = "";
  capa.appendChild(lienzo);
  capa.dataset.listo = "si";

  /**
   * El degradado que borra la foto por delante de los granos. Los topes van en el
   * alfa de los extremos y no clavando paradas en 0 y 1: con el frente todavía
   * fuera del lienzo, una parada opaca en 0 borraría de golpe la esquina entera
   * en el primer fotograma.
   */
  const degradado = (frente: number): CanvasGradient => {
    // La banda de la foto ocupa el PRIMER tramo del vuelo del grano, así que su
    // borde va por DELANTE del frente de los granos, no por detrás.
    //
    // Y se divide entre `1 - DISPERSION` porque el turno de los granos está
    // desordenado: `fin` tiene que ser el sitio donde ni siquiera el grano MÁS
    // ADELANTADO ha despegado todavía. Con el turno limpio bastaba con el frente;
    // con el turno desordenado, quedarse ahí dejaría a la foto asomando por
    // debajo de granos que aún no se han movido — o sea, revelándose antes que
    // ellos, que es justo lo que costó tres versiones quitar.
    const banda = (BANDA * FOTO_TRAS_POLVO) / (1 - DISPERSION);
    const fin = (frente + BANDA) / (1 - DISPERSION);
    const ini = fin - banda;
    const borrado = (s: number) => Math.min(1, Math.max(0, (fin - s) / banda));
    const g = ctx.createLinearGradient(0, oy + h, w, oy);
    g.addColorStop(0, `rgba(0,0,0,${borrado(0)})`);
    if (ini > 0 && ini < 1) g.addColorStop(ini, "rgba(0,0,0,1)");
    if (fin > 0 && fin < 1) g.addColorStop(fin, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${borrado(1)})`);
    return g;
  };

  // Lado del grano en reposo: la celda entera, redondeada hacia arriba para que
  // teselen sin dejar juntas. Al volar encoge.
  const lado = Math.ceil(Math.max(celdaW, celdaH));

  // Función FLECHA y no declaración: TypeScript no aplica el estrechamiento del
  // `if (!ctx) return null` de arriba dentro de una `function` —está izada, así
  // que podría llamarse antes—, y quedaría un archivo lleno de `ctx!`.
  const pintar = (progreso: number): void => {
    const p = Math.min(1, Math.max(0, progreso));
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    const frente = frenteDePolvo(p);

    if (p < 1) {
      ctx.globalAlpha = 1;
      // RECORTADA A SU CAJA. `object-fit: cover` significa por definición que la
      // foto SE SALE por uno de los dos ejes; en el DOM lo recortaba el
      // `overflow: hidden` de la pieza, pero un lienzo no recorta nada. Ese
      // sobrante caía fuera de la caja que borra el degradado y se quedaba
      // clavado para siempre: la franja del borde derecho que se reportó.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, oy, w, h);
      ctx.clip();
      ctx.drawImage(foto, cover.x, cover.y + oy, cover.w, cover.h);

      if (p > 0) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = degradado(frente);
        ctx.fillRect(0, oy, w, h);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    }

    // LOS GRANOS. Solo los que están en el aire; el resto o no han despegado —y
    // ahí está la foto— o ya se fueron. Eso es lo que mantiene el coste plano por
    // muchos granos que haya declarados.
    let cuboActual = -1;
    for (let n = 0; n < total; n++) {
      const t = vueloDeGrano(frente, uu[n]);
      if (t <= 0 || t >= 1) continue;

      const cubo = cubos[n];
      if (cubo !== cuboActual) {
        cuboActual = cubo;
        ctx.fillStyle = estilos.get(cubo)!;
      }
      // Se apaga al alejarse. En casa vale 1: ahí el grano ES su píxel de la
      // foto, y es lo que hace que la nube reconstruya la imagen al aterrizar.
      ctx.globalAlpha = Math.pow(1 - t, 0.75);
      // Acelera al irse (y frena al llegar, que es el mismo recorrido al revés) y
      // encoge por el camino: de tesela a grano de arena.
      const v = t * t;
      const s = lado * (1 - ENCOGE * t);
      ctx.fillRect(hx[n] + dx[n] * v - s / 2, hy[n] + dy[n] * v - s / 2, s, s);
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

/** Hasta aquí la foto se está armando. */
const FIN_ARMADO = 0.46;
/**
 * Y de `FIN_ARMADO` hasta aquí NO PASA NADA: la foto está entera y quieta. Ese
 * silencio es lo único que la convierte en una foto que se mira en vez de en un
 * efecto que se ve pasar, y es el único tramo del recorrido que no se recorta.
 */
const FIN_QUIETO = 0.66;

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
