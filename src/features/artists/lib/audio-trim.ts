/**
 * Recorte de audio EN EL NAVEGADOR. Decodifica el archivo a PCM (Web Audio),
 * corta el tramo [startSec, endSec) y lo re-codifica a MP3 con lamejs. Devuelve
 * un Blob `audio/mpeg` listo para subir — así NO se sube la canción completa,
 * solo el fragmento que el artista eligió (más liviano y sin filtrar el track).
 *
 * Lógica pura de dominio multimedia: sin React ni Firebase. La única atadura es
 * el navegador (AudioContext + lamejs), que es inherente a "cortar audio en el
 * cliente". El encode es síncrono y costoso, así que cede el hilo cada cierto
 * número de frames para que la UI (barra de progreso) pueda repintar.
 */
import { Mp3Encoder } from "@breezystack/lamejs";

/** Bitrate del MP3 de salida. 128 kbps = buena fidelidad para una intro, liviano. */
const MP3_KBPS = 128;
/** Tamaño de bloque PCM que consume lamejs por llamada (constante del códec). */
const SAMPLES_PER_FRAME = 1152;
/** Cada cuántos frames cedemos el hilo para repintar el progreso. */
const YIELD_EVERY = 256;

type AudioCtor = typeof AudioContext;

function audioContextCtor(): AudioCtor {
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: AudioCtor }).webkitAudioContext
  );
}

/** Decodifica un archivo de audio a `AudioBuffer` (PCM en memoria). */
export async function decodeAudioFile(file: Blob): Promise<AudioBuffer> {
  const ctx = new (audioContextCtor())();
  try {
    const arrayBuffer = await file.arrayBuffer();
    // decodeAudioData funciona con el contexto suspendido (no necesita gesto).
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    ctx.close().catch(() => {});
  }
}

/** Float [-1,1] → Int16 (lo que espera lamejs). Copia (no muta la fuente). */
function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/**
 * Corta `buffer` entre `startSec` y `endSec` y devuelve el fragmento como MP3.
 * Mantiene mono/estéreo del original (máx. 2 canales). `onProgress` recibe el
 * avance del encode en [0,1].
 */
export async function trimAudioBufferToMp3(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const { sampleRate } = buffer;
  const channels = Math.min(2, buffer.numberOfChannels);

  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(buffer.length, Math.ceil(endSec * sampleRate));
  const length = Math.max(0, endSample - startSample);

  const left = floatToInt16(
    buffer.getChannelData(0).subarray(startSample, endSample),
  );
  const right =
    channels > 1
      ? floatToInt16(buffer.getChannelData(1).subarray(startSample, endSample))
      : null;

  const encoder = new Mp3Encoder(channels, sampleRate, MP3_KBPS);
  const parts: Uint8Array[] = [];

  let frame = 0;
  for (let i = 0; i < length; i += SAMPLES_PER_FRAME) {
    const l = left.subarray(i, i + SAMPLES_PER_FRAME);
    const chunk = right
      ? encoder.encodeBuffer(l, right.subarray(i, i + SAMPLES_PER_FRAME))
      : encoder.encodeBuffer(l);
    if (chunk.length) parts.push(chunk);

    if (++frame % YIELD_EVERY === 0) {
      onProgress?.(length ? i / length : 1);
      // Cede el hilo: deja respirar al render del progreso.
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const tail = encoder.flush();
  if (tail.length) parts.push(tail);
  onProgress?.(1);

  // Cada parte es una vista sobre su propio ArrayBuffer; Blob las copia.
  return new Blob(parts as BlobPart[], { type: "audio/mpeg" });
}

/** Conveniencia: decodifica el archivo y recorta a MP3 en un solo paso. */
export async function trimAudioFileToMp3(
  file: Blob,
  startSec: number,
  endSec: number,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const buffer = await decodeAudioFile(file);
  return trimAudioBufferToMp3(buffer, startSec, endSec, onProgress);
}
