/**
 * Recorte + re-encode de video EN EL NAVEGADOR, sin dependencias.
 *
 * Usa `canvas.captureStream` + `MediaRecorder` en vez de ffmpeg.wasm: este último
 * exigiría cross-origin isolation (COOP/COEP) para su SharedArrayBuffer, y esas
 * cabeceras romperían los iframes de YouTube/Spotify de los temas destacados. El
 * re-encode además nos deja ACOTAR el bitrate para garantizar el tamaño de salida.
 *
 * La salida es SOLO video (mudo) — así se muestra el clip destacado (autoplay en
 * bucle sin sonido), y evita el manejo de pistas de audio entre navegadores.
 */

export interface VideoTrimResult {
  blob: Blob;
  /** MIME real del contenedor producido (mp4 o webm según el navegador). */
  mime: string;
  /** Extensión coherente con `mime`, para nombrar el archivo al subir. */
  ext: string;
  durationSec: number;
}

/** Mejor contenedor soportado por MediaRecorder (mp4 primero; si no, webm). */
function pickMime(): { mime: string; ext: string } {
  const candidates = [
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm;codecs=vp8", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  const supported =
    typeof MediaRecorder !== "undefined" &&
    typeof MediaRecorder.isTypeSupported === "function";
  for (const c of candidates) {
    if (supported && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  // Sin match: deja que el navegador elija su contenedor por defecto (webm).
  return { mime: "", ext: "webm" };
}

export interface TrimOptions {
  /** Tope de tamaño de salida (bytes). Fija el bitrate objetivo. */
  maxBytes: number;
  /** Ancho máximo del video de salida (se escala manteniendo aspecto). */
  maxWidth?: number;
  fps?: number;
}

/**
 * Recorta el tramo [start, end] (segundos) del archivo y lo re-encodea con un
 * bitrate calculado para caber bajo `maxBytes`. Devuelve el Blob resultante.
 * `onProgress` reporta 0→1 según avanza la captura (que ocurre en tiempo real).
 */
export function trimVideo(
  file: File,
  start: number,
  end: number,
  opts: TrimOptions,
  onProgress?: (p: number) => void,
): Promise<VideoTrimResult> {
  return new Promise((resolve, reject) => {
    const clip = Math.max(0.1, end - start);
    const fps = opts.fps ?? 30;
    const maxWidth = opts.maxWidth ?? 720;

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let raf = 0;
    let settled = false;
    const cleanup = () => {
      cancelAnimationFrame(raf);
      URL.revokeObjectURL(url);
    };
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(reason));
    };

    video.onerror = () => fail("load");

    video.onloadedmetadata = () => {
      const srcW = video.videoWidth || maxWidth;
      const srcH = video.videoHeight || maxWidth;
      const scale = Math.min(1, maxWidth / srcW);
      const w = Math.max(2, Math.round(srcW * scale));
      const h = Math.max(2, Math.round(srcH * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return fail("ctx");

      // Bitrate objetivo: que quepa bajo maxBytes con 15% de margen; acotado a un
      // rango razonable para un clip corto de fondo (0.8–6 Mbps).
      const target = Math.floor((opts.maxBytes * 8 * 0.85) / clip);
      const videoBitsPerSecond = Math.max(800_000, Math.min(target, 6_000_000));

      const { mime, ext } = pickMime();
      const stream = canvas.captureStream(fps);

      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(
          stream,
          mime ? { mimeType: mime, videoBitsPerSecond } : { videoBitsPerSecond },
        );
      } catch {
        return fail("recorder");
      }

      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const outMime = rec.mimeType || mime || "video/webm";
        resolve({
          blob: new Blob(chunks, { type: outMime }),
          mime: outMime,
          ext,
          durationSec: clip,
        });
      };

      const draw = () => {
        ctx.drawImage(video, 0, 0, w, h);
        onProgress?.(Math.min(1, (video.currentTime - start) / clip));
        if (video.currentTime >= end || video.ended) {
          video.pause();
          if (rec.state !== "inactive") rec.stop();
          return;
        }
        raf = requestAnimationFrame(draw);
      };

      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        try {
          rec.start();
        } catch {
          return fail("recorder");
        }
        video
          .play()
          .then(() => {
            raf = requestAnimationFrame(draw);
          })
          .catch(() => fail("play"));
      };
      video.addEventListener("seeked", onSeeked);
      // Posiciona al inicio del recorte (dispara "seeked" → arranca la captura).
      video.currentTime = Math.min(start, video.duration || start);
    };
  });
}
