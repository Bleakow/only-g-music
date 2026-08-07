/**
 * Metadatos de un vídeo LEÍDOS EN EL NAVEGADOR, antes de subir nada.
 *
 * Vivía dentro de `ProfileBuilder` cuando solo lo usaba la media destacada. El
 * book (§10) necesita lo mismo, así que se saca aquí: dos copias de esto acaban
 * divergiendo justo en el detalle que importa (qué se considera "vertical").
 *
 * No hay procesado de media en el servidor —ni `sharp` ni `ffmpeg` en
 * Functions— y no hace falta: el navegador ya sabe leer un vídeo y pintar un
 * fotograma en un canvas.
 */

/**
 * Duración y PROPORCIÓN de un vídeo, sin subirlo. La proporción se guarda con la
 * pieza porque de ella depende cómo se presenta y, sobre todo, cuánto sitio hay
 * que reservarle: medirla al pintar haría que la página se recompusiera sola a
 * mitad de carga.
 */
export function videoMeta(
  file: Blob,
): Promise<{ duration: number; ratio: number | undefined }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: v.duration,
        ratio:
          v.videoWidth > 0 && v.videoHeight > 0
            ? v.videoWidth / v.videoHeight
            : undefined,
      });
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("metadata"));
    };
    v.src = url;
  });
}

/**
 * PROPORCIÓN de una imagen, sin subirla. Mismo motivo que en el vídeo: con el
 * ratio guardado, el hueco de la foto está reservado antes de que llegue el
 * archivo y el scroll no da tirones. Devuelve `undefined` si no se puede leer.
 */
export function imagenMeta(file: Blob): Promise<{ ratio: number | undefined }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        ratio:
          img.naturalWidth > 0 && img.naturalHeight > 0
            ? img.naturalWidth / img.naturalHeight
            : undefined,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ratio: undefined });
    };
    img.src = url;
  });
}

/**
 * PÓSTER de un vídeo: un fotograma del principio, en JPEG.
 *
 * Sin él, un vídeo con `preload="none"` —que es como se sirven los clips del
 * book, para no gastar datos hasta que se van a ver— pinta un rectángulo negro
 * mientras tanto. Con póster, la pieza se ve desde el primer momento y el clip
 * arranca cuando toca.
 *
 * NUNCA lanza: devuelve `null` si el navegador no colabora (formato raro, sin
 * canvas, vídeo de un solo fotograma). Quedarse sin póster degrada la pieza, no
 * la rompe, y desde luego no es motivo para impedir subir el clip.
 */
export function posterDeVideo(file: Blob, segundo = 0.1): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;

    const acabar = (blob: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };

    v.onloadeddata = () => {
      // Un pelín dentro y nunca más allá del final: el fotograma 0 de muchos
      // clips es negro (el fundido de entrada de la cámara).
      v.currentTime = Math.min(segundo, Math.max(0, (v.duration || 1) - 0.05));
    };

    v.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width) return acabar(null);
        ctx.drawImage(v, 0, 0);
        canvas.toBlob((b) => acabar(b), "image/jpeg", 0.72);
      } catch {
        acabar(null);
      }
    };

    v.onerror = () => acabar(null);
    v.src = url;
  });
}
