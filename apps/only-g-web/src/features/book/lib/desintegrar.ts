/**
 * EL DESINTEGRADO de la foto de portada.
 *
 * La foto se parte en teselas —cada una enseña su trozo por
 * `background-position`— y vuelan al entrar y al salir. Es el efecto de la
 * biblioteca de GSAP, con una diferencia deliberada: aquí va atado al SCROLL,
 * no al tiempo. Con física real (`Physics2DPlugin`) el desintegrado no se puede
 * rebobinar, y en una secuencia que se recorre subiendo y bajando eso significa
 * que al volver hacia arriba las piezas no regresarían a su sitio. Por eso el
 * desperdigado es DETERMINISTA: cada tesela tiene su ángulo y su distancia
 * derivados de su índice, así el mismo scroll da siempre la misma imagen y la
 * secuencia se puede recorrer en los dos sentidos.
 *
 * LA TRAMPA QUE RESUELVE ESTE MÓDULO: la url. `next/image` no sirve el archivo
 * original sino una variante optimizada, así que apuntar las teselas a la url de
 * Storage descargaría la foto DOS VECES —y esta pesa lo que pesa un retrato—.
 * Se lee `currentSrc` de la imagen que ya está en la página: exactamente el
 * mismo recurso, cero bytes de más.
 */

export interface Tesela {
  el: HTMLElement;
  /** Desperdigado en reposo: a dónde vuela esta tesela. */
  x: number;
  y: number;
  rot: number;
  /** 0..1 — reparte el escalonado para que no salgan todas a la vez. */
  retardo: number;
}

/** Columnas según el ancho real: en móvil menos teselas, que son menos capas. */
function columnasPara(ancho: number): number {
  if (ancho < 260) return 9;
  if (ancho < 420) return 12;
  return 16;
}

/**
 * Ruido determinista a partir de un entero. Se usa en vez de `Math.random()`
 * porque el desintegrado se reconstruye al redimensionar: con azar de verdad, la
 * foto se re-desperdigaría distinta a mitad de scroll.
 */
function ruido(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Espera a que la imagen esté cargada para poder leer su `currentSrc`. Antes de
 * cargar, `currentSrc` es cadena vacía y las teselas saldrían en blanco.
 */
export function urlYaCargada(img: HTMLImageElement): Promise<string> {
  if (img.complete && img.currentSrc) return Promise.resolve(img.currentSrc);
  return new Promise((resolve) => {
    const listo = () => resolve(img.currentSrc || img.src);
    img.addEventListener("load", listo, { once: true });
    img.addEventListener("error", listo, { once: true });
  });
}

/**
 * Construye las teselas dentro de `capa`, recortando `url` en una rejilla del
 * tamaño de `marco`. Devuelve la lista con el destino de vuelo de cada una.
 */
export function construirTeselas(
  marco: HTMLElement,
  capa: HTMLElement,
  url: string,
): Tesela[] {
  const w = marco.clientWidth;
  const h = marco.clientHeight;
  if (!w || !h) return [];

  const cols = columnasPara(w);
  const tw = w / cols;
  // Teselas aproximadamente cuadradas: es lo que hace que el desintegrado se lea
  // como polvo y no como una persiana.
  const filas = Math.max(4, Math.round(h / tw));
  const th = h / filas;

  capa.textContent = "";
  const frag = document.createDocumentFragment();
  const teselas: Tesela[] = [];

  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const i = f * cols + c;
      const el = document.createElement("div");
      el.className = "og-book-desint-tesela";
      el.style.left = `${c * tw}px`;
      el.style.top = `${f * th}px`;
      // +1px de solape: sin él, el redondeo a subpíxel deja una rejilla de
      // líneas finas del fondo entre tesela y tesela cuando están montadas.
      el.style.width = `${tw + 1}px`;
      el.style.height = `${th + 1}px`;
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundSize = `${w}px ${h}px`;
      el.style.backgroundPosition = `${-c * tw}px ${-f * th}px`;
      frag.appendChild(el);

      // El vuelo se abre desde el CENTRO del marco: las teselas del borde salen
      // más lejos que las de dentro, que es como se deshace algo de verdad.
      const dx = (c + 0.5) / cols - 0.5;
      const dy = (f + 0.5) / filas - 0.5;
      const dist = 40 + ruido(i) * 190;
      const desvio = (ruido(i + 7919) - 0.5) * 0.9;
      teselas.push({
        el,
        x: (dx * 2 + desvio) * dist,
        y: (dy * 2 + desvio) * dist - ruido(i + 104729) * 60,
        rot: (ruido(i + 15485863) - 0.5) * 160,
        retardo: ruido(i + 32452843),
      });
    }
  }

  capa.appendChild(frag);
  capa.dataset.listo = "si";
  return teselas;
}

/** Deshace las teselas. Sin esto quedan cientos de nodos por escena. */
export function limpiarTeselas(capa: HTMLElement): void {
  capa.textContent = "";
  delete capa.dataset.listo;
}
