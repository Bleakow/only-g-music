import { frenteDePolvo, ruido, vueloDeGrano, type Polvo } from "./reloj-desintegrado";

/**
 * LAMAS — la portada como una persiana.
 *
 * Nada de partículas: la foto se corta en tiras horizontales que GIRAN SOBRE SU
 * EJE, como las lamas de una veneciana. Al ponerse de canto desaparecen; al
 * abrirse, la foto vuelve. Es un mecanismo, no un desmenuzado, y esa es toda la
 * gracia — en un catálogo donde todo lo demás se rompe, esta no rompe nada.
 *
 * EL GIRO ES FALSO Y NO HACE FALTA QUE LO SEA MENOS. Una lama girando sobre su
 * eje horizontal se ve, en proyección, como la misma tira con menos alto: el
 * coseno del ángulo. Así que basta con dibujarla achatada contra su eje. Montar
 * una perspectiva de verdad (`transform: rotateX` en 3D) obligaría a sacar cada
 * lama a su propio elemento del DOM —decenas de capas de composición, que es lo
 * que ya arruinó la primera versión del desintegrado— para ganar un escorzo que
 * a este tamaño nadie distingue.
 *
 * Lo que SÍ hay que dibujar es la LUZ. Una lama que solo se achata parece una
 * tira encogiéndose; con la sombra que gana al girar, se lee como una lama que
 * se pone de canto. La sombra es la mitad del efecto y cuesta un `fillRect`.
 */

/** Alto de una lama en píxeles de CSS. */
const LAMA_CSS = 22;

/** Tope: por encima, las lamas se ensanchan solas. */
const LAMAS_MAX = 30;

const DPR_MAX = 1.5;

/** Cuánto se desplaza una lama de lado mientras gira, en fracción del ancho. */
const DESLIZ = 0.22;

export function construirLamas(
  capaHost: HTMLElement,
  anchoCss: number,
  altoCss: number,
  dibujarFoto: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): Polvo | null {
  const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
  const w = Math.round(anchoCss * dpr);
  const h = Math.round(altoCss * dpr);
  if (!w || !h) return null;

  const fuente = document.createElement("canvas");
  fuente.width = w;
  fuente.height = h;
  const fctx = fuente.getContext("2d");
  if (!fctx) return null;
  dibujarFoto(fctx, w, h);

  const total = Math.max(4, Math.min(LAMAS_MAX, Math.round(altoCss / LAMA_CSS)));
  const alto = h / total;

  // Sitio para el desliz lateral, y nada más: las lamas no vuelan, así que el
  // lienzo apenas se sale de la foto. Un margen generoso aquí serían píxeles que
  // limpiar en cada fotograma sin nada que enseñar en ellos.
  const margen = DESLIZ + 0.06;
  const ox = Math.round(w * margen);
  const lienzo = document.createElement("canvas");
  lienzo.className = "og-book-desint-lienzo";
  lienzo.width = w + ox * 2;
  lienzo.height = h;
  lienzo.style.left = `${-margen * 100}%`;
  lienzo.style.top = "0%";
  lienzo.style.width = `${(1 + margen * 2) * 100}%`;
  lienzo.style.height = "100%";
  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;

  capaHost.textContent = "";
  capaHost.appendChild(lienzo);
  capaHost.dataset.listo = "si";

  const pintar = (progreso: number, armando: boolean): void => {
    const p = Math.min(1, Math.max(0, progreso));
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    const frente = frenteDePolvo(p);

    for (let i = 0; i < total; i++) {
      /**
       * EL TURNO. Al armar, la persiana se abre DE ABAJO ARRIBA; al deshacerse
       * se cierra DE ARRIBA ABAJO. No es adorno: con el mismo turno en los dos
       * sentidos, la segunda mitad de la secuencia sería la primera rebobinada,
       * que es exactamente lo que se pidió evitar.
       */
      const sitio = armando ? 1 - i / (total - 1) : i / (total - 1);
      const bruto = vueloDeGrano(frente, sitio);
      if (bruto >= 1) continue;
      // Sin descartar por abajo: una lama que aún no ha girado tiene que
      // dibujarse ENTERA, porque entre todas son la foto. Aquí no hay una foto
      // debajo rellenando huecos — las lamas son lo único que hay.
      const t = Math.max(0, bruto);

      // El achatamiento contra el eje ES el giro. `cos` de cero a noventa grados.
      const escala = Math.cos((t * Math.PI) / 2);
      const y = i * alto;
      const centro = y + alto / 2;
      const dh = alto * escala;

      /**
       * El desliz separa la llegada de la salida más que ninguna otra cosa: al
       * armar, las lamas entran ALTERNANDO lados —se cierra como una cremallera—
       * y al deshacerse se van todas hacia el mismo, como si alguien tirara del
       * cordón.
       */
      const dx = armando
        ? (i % 2 === 0 ? -1 : 1) * DESLIZ * w * t
        : DESLIZ * w * t * (0.65 + ruido(i) * 0.7);

      ctx.drawImage(
        fuente,
        0,
        y,
        w,
        alto,
        ox + dx,
        centro - dh / 2,
        w,
        Math.max(0.5, dh),
      );

      // LA LUZ. Sin esto la lama parece una tira que encoge; con la sombra que
      // gana al ponerse de canto, se lee como una lama que gira.
      if (t > 0) {
        ctx.globalAlpha = Math.min(0.72, t * 0.85);
        ctx.fillStyle = "#000";
        ctx.fillRect(ox + dx, centro - dh / 2, w, Math.max(0.5, dh));
        ctx.globalAlpha = 1;
      }
    }
  };

  pintar(1, true);

  return {
    pintar,
    destruir() {
      capaHost.textContent = "";
      delete capaHost.dataset.listo;
      fuente.width = 0;
      fuente.height = 0;
    },
  };
}
