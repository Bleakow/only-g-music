import { drawArtQr } from "@/lib/qr-art";

/**
 * "Estampa" de compartir: la imagen que el artista descarga o manda por
 * WhatsApp — su foto de fondo, el QR de marca y la placa de Only G en el centro.
 *
 * Se compone en un canvas y NO con html2canvas ni una captura del DOM: el
 * resultado tiene que salir idéntico en cualquier móvil (donde el ancho de la
 * pantalla cambiaría el layout) y con la resolución fija de abajo, que no
 * depende del `devicePixelRatio` del aparato.
 */

/**
 * 1080×1350 (4:5). Es el retrato más alto que Instagram y WhatsApp muestran
 * ENTERO: en 9:16 recortan por arriba y por abajo, y ahí es donde va el QR.
 */
const W = 1080;
const H = 1350;
const PAD = 88;

/** Tarjeta blanca del QR. */
const CARD_SIDE = 660;
const CARD_Y = 372;
const CARD_RADIUS = 52;
/** Aire entre el borde de la tarjeta y el QR (la "quiet zone" del código). */
const CARD_INSET = 44;

/** Placa central con la marca (el equivalente al icono de app). */
const BADGE_SIDE = 128;
/** Separación entre la placa y el módulo más cercano. */
const BADGE_GAP = 12;

const INK = "#0b0b0f";
const AMETHYST = "#a87bff";

export interface ShareCardInput {
  /** URL que codifica el QR (la del perfil público). */
  url: string;
  /** Nombre artístico, protagonista de la tarjeta. */
  name: string;
  /** Foto de portada del perfil. Sin ella, la tarjeta cae a un degradado. */
  photoUrl?: string | null;
  /** Línea pequeña de marca sobre el nombre. */
  brand: string;
  /** Instrucción bajo el QR ("Escanea el código…"). */
  caption: string;
  /** Texto de la placa central. Provisional hasta tener un logo cuadrado. */
  badge?: string;
}

/** Compone la estampa y la devuelve como PNG listo para descargar o compartir. */
export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-no-disponible");

  const [foto] = await Promise.all([loadImage(input.photoUrl), ensureFonts()]);

  drawBackground(ctx, foto);
  drawHeader(ctx, input.brand, input.name);
  drawQrCard(ctx, input.url, input.badge);
  drawFooter(ctx, input.caption, input.url);

  return toBlob(canvas);
}

// ── Fondo ───────────────────────────────────────────────────────────────────

function drawBackground(
  ctx: CanvasRenderingContext2D,
  foto: HTMLImageElement | null,
): void {
  if (foto) {
    drawCover(ctx, foto);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#2a1758");
    g.addColorStop(1, INK);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Velo: la foto es del artista y puede ser clarísima o carísima de leer. Con
  // el degradado + el plano, el texto blanco y el QR mantienen contraste sea
  // cual sea la foto, sin tener que analizarla.
  const velo = ctx.createLinearGradient(0, 0, 0, H);
  velo.addColorStop(0, "rgba(0,0,0,0.45)");
  velo.addColorStop(0.5, "rgba(0,0,0,0.6)");
  velo.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = velo;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(11,11,15,0.3)";
  ctx.fillRect(0, 0, W, H);
}

/** `object-fit: cover` a mano: llena el lienzo sin deformar la foto. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
): void {
  const escala = Math.max(W / img.width, H / img.height);
  const w = img.width * escala;
  const h = img.height * escala;
  // Horizontal centrado; vertical al 35 % en vez de al 50 % porque en un retrato
  // la cara suele estar en el tercio superior y centrar la decapita.
  ctx.drawImage(img, (W - w) / 2, (H - h) * 0.35, w, h);
}

// ── Textos ──────────────────────────────────────────────────────────────────

function drawHeader(
  ctx: CanvasRenderingContext2D,
  brand: string,
  name: string,
): void {
  ctx.save();
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = '600 26px OGM, system-ui, sans-serif';
  setLetterSpacing(ctx, "7px");
  ctx.fillText(brand.toUpperCase(), W / 2, 168);
  setLetterSpacing(ctx, "0px");

  const nombre = name.trim().toUpperCase();
  ctx.fillStyle = "#ffffff";
  ctx.font = fitFont(ctx, nombre, W - PAD * 2, 88, 52);
  ctx.fillText(ellipsize(ctx, nombre, W - PAD * 2), W / 2, 274);

  ctx.restore();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  caption: string,
  url: string,
): void {
  ctx.save();
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = '500 30px OGM, system-ui, sans-serif';
  ctx.fillText(ellipsize(ctx, caption, W - PAD * 2), W / 2, 1116);

  ctx.fillStyle = AMETHYST;
  ctx.font = '600 26px OGM, system-ui, sans-serif';
  ctx.fillText(ellipsize(ctx, limpiarUrl(url), W - PAD * 2), W / 2, 1172);

  ctx.restore();
}

// ── QR ──────────────────────────────────────────────────────────────────────

function drawQrCard(
  ctx: CanvasRenderingContext2D,
  url: string,
  badge: string | undefined,
): void {
  const x = (W - CARD_SIDE) / 2;
  const qrSide = CARD_SIDE - CARD_INSET * 2;
  const qrX = x + CARD_INSET;
  const qrY = CARD_Y + CARD_INSET;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x, CARD_Y, CARD_SIDE, CARD_SIDE, CARD_RADIUS);
  ctx.fill();
  ctx.restore();

  drawArtQr(ctx, url, qrX, qrY, {
    size: qrSide,
    color: INK,
    logoRatio: (BADGE_SIDE + BADGE_GAP * 2) / qrSide,
  });

  drawBadge(ctx, W / 2, CARD_Y + CARD_SIDE / 2, badge);
}

/**
 * Placa central. Hoy es la sigla en la tipografía de marca: los PNG del logo
 * traen el degradado gris de fondo INCRUSTADO y sobre el QR blanco se ven como
 * un recorte mal hecho. Con un logo cuadrado en transparencia, esto pasa a ser
 * un `drawImage` dentro de la misma caja redondeada.
 */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  texto: string | undefined,
): void {
  if (!texto) return;
  const mitad = BADGE_SIDE / 2;

  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(cx - mitad, cy - mitad, BADGE_SIDE, BADGE_SIDE, 30);
  ctx.fill();

  ctx.strokeStyle = "rgba(168,123,255,0.85)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(cx - mitad + 2, cy - mitad + 2, BADGE_SIDE - 4, BADGE_SIDE - 4, 28);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = fitFont(ctx, texto, BADGE_SIDE - 32, 44, 24);
  ctx.fillText(texto, cx, cy + 2);
  ctx.restore();
}

// ── Utilidades ──────────────────────────────────────────────────────────────

/**
 * Trae la foto por el optimizador de Next.
 *
 * IMPRESCINDIBLE: las fotos viven en Firebase Storage, otro origen. Un canvas
 * que dibuja una imagen de fuera queda TAINTED y `toBlob` lanza un
 * `SecurityError` — no hay descarga ni compartir, y el fallo aparece al final,
 * cuando la tarjeta ya se ve bien en pantalla. Servida por `/_next/image` la
 * imagen es del NUESTRO origen y el lienzo se queda limpio.
 */
function sameOriginSrc(url: string): string {
  if (url.startsWith("/")) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${W}&q=75`;
}

function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    // Sin foto la tarjeta sigue saliendo (degradado): que una portada rota no
    // deje al artista sin poder compartir.
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = sameOriginSrc(url);
  });
}

/**
 * Espera a las fuentes de marca. Sin esto el canvas dibuja con la de respaldo:
 * `document.fonts` resuelve DESPUÉS de que el navegador decida que las necesita,
 * y un canvas no cuenta como uso que las dispare.
 */
async function ensureFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load("700 88px OGMNarrow"),
      document.fonts.load("500 30px OGM"),
    ]);
  } catch {
    /* si no cargan, se dibuja con system-ui: fea pero legible */
  }
}

/** Baja el cuerpo de letra hasta que el texto quepa a lo ancho. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  desde: number,
  hasta: number,
): string {
  for (let px = desde; px > hasta; px -= 2) {
    const font = `700 ${px}px OGMNarrow, system-ui, sans-serif`;
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return font;
  }
  return `700 ${hasta}px OGMNarrow, system-ui, sans-serif`;
}

/** Recorta con puntos suspensivos si aun así no cabe. */
function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let corte = text;
  while (corte.length > 1 && ctx.measureText(`${corte}…`).width > maxWidth) {
    corte = corte.slice(0, -1);
  }
  return `${corte}…`;
}

/** `https://only-g.com/artistas/x` → `only-g.com/artistas/x`. */
function limpiarUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * `ctx.letterSpacing` es reciente. Se asigna por cast en vez de tipar el ctx:
 * donde no exista, la propiedad simplemente se ignora y el texto sale junto.
 */
function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string): void {
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
    value;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("sin-blob"))),
      "image/png",
    );
  });
}
