import type { Polvo } from "./reloj-desintegrado";

/**
 * BRUMA — la portada no se rompe: se CONDENSA y se EVAPORA.
 *
 * Es la única del catálogo que no parte la foto en nada. Llega desde un borrón
 * de luz que se contrae y afina hasta ser la imagen; se va hinchándose y
 * desenfocándose hasta que solo queda un resplandor. Ni granos, ni cuadrados, ni
 * lamas — óptica.
 *
 * Existe por una razón concreta: en un catálogo donde todo lo demás DESTRUYE la
 * foto, hace falta una opción para quien no quiere que su portada se rompa. Una
 * modelo puede querer que su book se sienta suave, y ninguna cantidad de arena
 * es suave.
 *
 * ── CÓMO, SIN QUEMAR FOTOGRAMAS ───────────────────────────────────────────
 * `ctx.filter = "blur(Npx)"` es correcto y es carísimo: desenfocar una foto
 * entera en cada fotograma cuesta más que dibujar veinte mil partículas. Así que
 * el desenfoque se PRECOCINA — media docena de niveles calculados una sola vez
 * al montar— y pintar es mezclar los dos niveles vecinos. Dos `drawImage` por
 * fotograma.
 *
 * Y los niveles borrosos se guardan a MEDIA RESOLUCIÓN. No es un ahorro
 * arriesgado: un desenfoque de veinte píxeles ya ha tirado ese detalle, así que
 * guardarlo es guardar ceros. Solo el nivel nítido va a tamaño completo, que es
 * el único que se mira de cerca.
 *
 * EL FANTASMA. Un desenfoque a secas se lee como una foto mal cargada. Lo que lo
 * convierte en luz es dibujar el nivel borroso VARIAS VECES con un desplazamiento
 * mínimo: la imagen se derrama en la dirección del movimiento. Cuesta dos
 * `drawImage` más y es la diferencia entre "está borroso" y "se está deshaciendo".
 */

/** Niveles de desenfoque precocinados. Más son más memoria y más suavidad. */
const NIVELES = 6;

/** Desenfoque del último nivel, en fracción del ancho de la foto. */
const BORRON = 0.085;

/** Los niveles borrosos se guardan a esta fracción del tamaño. */
const MENGUA = 0.5;

const DPR_MAX = 1.5;

/** Cuánto encoge al llegar y cuánto se hincha al irse. */
const ENTRA_DESDE = 0.88;
const SALE_HASTA = 1.24;

/** Copias desplazadas del nivel borroso. Es lo que lo convierte en luz. */
const FANTASMAS = 2;

export function construirBruma(
  capaHost: HTMLElement,
  anchoCss: number,
  altoCss: number,
  dibujarFoto: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): Polvo | null {
  const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
  const w = Math.round(anchoCss * dpr);
  const h = Math.round(altoCss * dpr);
  if (!w || !h) return null;

  const nitido = document.createElement("canvas");
  nitido.width = w;
  nitido.height = h;
  const nctx = nitido.getContext("2d");
  if (!nctx) return null;
  dibujarFoto(nctx, w, h);

  // ── Los niveles ───────────────────────────────────────────────────────────
  // El 0 es la foto tal cual; del 1 en adelante, cada vez más borrosos y a media
  // resolución. Se calculan UNA vez: aquí está todo el coste del efecto.
  const capas: HTMLCanvasElement[] = [nitido];
  const mw = Math.max(1, Math.round(w * MENGUA));
  const mh = Math.max(1, Math.round(h * MENGUA));
  for (let i = 1; i < NIVELES; i++) {
    const c = document.createElement("canvas");
    c.width = mw;
    c.height = mh;
    const cx = c.getContext("2d");
    if (!cx) return null;
    // El desenfoque crece con el CUADRADO del nivel: repartido a partes iguales,
    // los primeros pasos se notarían de más y los últimos, nada.
    const radio = BORRON * w * MENGUA * Math.pow(i / (NIVELES - 1), 2);
    cx.filter = `blur(${radio.toFixed(2)}px)`;
    cx.drawImage(nitido, 0, 0, mw, mh);
    cx.filter = "none";
    capas.push(c);
  }

  // Sitio para que la foto se hinche y para que el borrón se derrame fuera de
  // sus bordes: sin él, el resplandor se cortaría en un rectángulo perfecto.
  const margen = (SALE_HASTA - 1) / 2 + 0.14;
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

  /** Pinta un nivel centrado, escalado y con su transparencia. */
  const capaEn = (i: number, escala: number, alfa: number, sx: number, sy: number) => {
    if (alfa <= 0.004) return;
    const dw = w * escala;
    const dh = h * escala;
    ctx.globalAlpha = alfa;
    ctx.drawImage(
      capas[i],
      ox + (w - dw) / 2 + sx,
      oy + (h - dh) / 2 + sy,
      dw,
      dh,
    );
  };

  const pintar = (progreso: number, armando: boolean): void => {
    const p = Math.min(1, Math.max(0, progreso));
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    if (p >= 1) return;

    /**
     * LLEGA CONTRAYÉNDOSE Y SE VA HINCHÁNDOSE, y ese cambio de signo es lo que
     * impide que la salida sea la entrada rebobinada. Una es la imagen
     * concentrándose desde una nube; la otra, la imagen soltándose en una.
     */
    const escala = armando
      ? ENTRA_DESDE + (1 - ENTRA_DESDE) * (1 - p)
      : 1 + (SALE_HASTA - 1) * p;

    // El nivel exacto y los dos vecinos entre los que se mezcla. Sin la mezcla
    // se verían los seis escalones del desenfoque como saltos.
    const nivel = p * (NIVELES - 1);
    const bajo = Math.min(NIVELES - 1, Math.floor(nivel));
    const alto = Math.min(NIVELES - 1, bajo + 1);
    const mezcla = nivel - bajo;

    // Se apaga tarde: si la opacidad cayera al ritmo del desenfoque, la foto se
    // habría ido antes de llegar a verse borrosa y el efecto sería un fundido.
    const alfa = Math.pow(1 - p, 0.55);

    capaEn(bajo, escala, alfa * (1 - mezcla), 0, 0);
    capaEn(alto, escala, alfa * mezcla, 0, 0);

    /**
     * LOS FANTASMAS. Copias del nivel más borroso, desplazadas un poco en la
     * dirección del movimiento: al llegar convergen hacia el centro, al irse se
     * abren. Solo aparecen cuando ya hay borrón que derramar — antes serían una
     * foto nítida con dos sombras, que es un defecto y no un efecto.
     */
    if (p > 0.25) {
      const fuerza = (p - 0.25) / 0.75;
      const alcance = (armando ? -1 : 1) * fuerza * 0.055 * w;
      for (let g = 1; g <= FANTASMAS; g++) {
        const a = (g / FANTASMAS) * alcance;
        capaEn(NIVELES - 1, escala * (1 + 0.05 * fuerza * g), alfa * 0.3, a, a * 0.55);
        capaEn(NIVELES - 1, escala * (1 + 0.05 * fuerza * g), alfa * 0.3, -a, -a * 0.55);
      }
    }

    ctx.globalAlpha = 1;
  };

  pintar(1, true);

  return {
    pintar,
    destruir() {
      capaHost.textContent = "";
      delete capaHost.dataset.listo;
      for (const c of capas) {
        c.width = 0;
        c.height = 0;
      }
      capas.length = 0;
    },
  };
}
