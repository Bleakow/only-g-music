import QRCode from "qrcode";

/**
 * QR "de marca": módulos redondos, esquinas en anillo y un hueco central para el
 * logo. Es el mismo código de siempre — solo cambia cómo se pinta cada módulo,
 * que el estándar no fija.
 *
 * Dibuja sobre un canvas 2D en vez de generar un PNG con `QRCode.toDataURL`
 * porque esa API solo sabe pintar cuadrados negros: para redondear los módulos
 * hace falta la MATRIZ (`QRCode.create`), que es lo que se usa aquí.
 */

/**
 * Tope del hueco central. El nivel de corrección H recupera ~30 % del código,
 * pero ese presupuesto también absorbe reflejos y dobleces del papel: pasar de
 * ~26 % del lado deja el QR bonito y sin leer, que es el peor resultado posible.
 */
const MAX_LOGO_RATIO = 0.26;

/** Lado, en módulos, de los tres patrones de búsqueda (las esquinas). */
const FINDER = 7;

/**
 * Aire entre módulos, como fracción de la celda. Es lo que da el aspecto de
 * "puntos" en vez de bloque sólido; por debajo de ~0.8 se pierde contraste.
 */
const DOT_SCALE = 0.86;

export interface ArtQrOptions {
  /** Lado del QR en píxeles del canvas (sin margen: lo pone quien llama). */
  size: number;
  /** Color de los módulos. El fondo lo pinta quien llama. */
  color: string;
  /** Fracción del lado reservada en el centro para el logo. 0 = sin hueco. */
  logoRatio?: number;
}

/**
 * ¿Este módulo pertenece a uno de los tres patrones de búsqueda? Se dibujan
 * aparte (como anillo redondeado) porque son lo primero que localiza el lector:
 * troceados en puntos sueltos, muchos escáneres tardan o fallan.
 *
 * Puro y exportado para poder testearlo sin canvas.
 */
export function isFinderModule(row: number, col: number, size: number): boolean {
  const enEsquina = (r: number, c: number, r0: number, c0: number) =>
    r >= r0 && r < r0 + FINDER && c >= c0 && c < c0 + FINDER;
  return (
    enEsquina(row, col, 0, 0) ||
    enEsquina(row, col, 0, size - FINDER) ||
    enEsquina(row, col, size - FINDER, 0)
  );
}

/** Fracción de hueco central efectiva (acotada para no romper la lectura). */
export function clampLogoRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.min(ratio, MAX_LOGO_RATIO);
}

/** Dibuja el QR estilizado con su esquina superior izquierda en (x, y). */
export function drawArtQr(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  { size, color, logoRatio = 0 }: ArtQrOptions,
): void {
  // Corrección "H" (~30 % recuperable) porque el logo TAPA módulos: con un nivel
  // menor el hueco se come más de lo que el código puede reconstruir.
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "H" });
  const n = modules.size;
  const cell = size / n;

  const hueco = clampLogoRatio(logoRatio) * size;
  const huecoIni = (size - hueco) / 2;
  const huecoFin = huecoIni + hueco;

  ctx.save();
  ctx.fillStyle = color;

  for (const [fila, columna] of [
    [0, 0],
    [0, n - FINDER],
    [n - FINDER, 0],
  ]) {
    drawFinder(ctx, x + columna * cell, y + fila * cell, cell);
  }

  const radio = (cell * DOT_SCALE) / 2;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!modules.get(row, col)) continue;
      if (isFinderModule(row, col, n)) continue;

      const cx = col * cell + cell / 2;
      const cy = row * cell + cell / 2;
      const enHueco =
        hueco > 0 &&
        cx > huecoIni &&
        cx < huecoFin &&
        cy > huecoIni &&
        cy < huecoFin;
      if (enHueco) continue;

      ctx.beginPath();
      ctx.arc(x + cx, y + cy, radio, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Una esquina: anillo exterior de 7×7 con un módulo de grosor (relleno par-impar
 * = se recorta el centro de una sola pasada) más el punto interior de 3×3.
 */
function drawFinder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, FINDER * cell, FINDER * cell, cell * 2);
  ctx.roundRect(x + cell, y + cell, 5 * cell, 5 * cell, cell * 1.4);
  ctx.fill("evenodd");

  ctx.beginPath();
  ctx.roundRect(x + 2 * cell, y + 2 * cell, 3 * cell, 3 * cell, cell);
  ctx.fill();
}
