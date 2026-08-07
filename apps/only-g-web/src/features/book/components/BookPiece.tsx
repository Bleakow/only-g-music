"use client";

import Image from "next/image";
import { useEffect } from "react";
import type { PiezaBook } from "@only-g/shared-types/book";
import { useOnScreen } from "@/lib/use-on-screen";

/**
 * Una pieza del book: una foto o un vídeo MUDO EN BUCLE.
 *
 * El vídeo se comporta como "una foto que se mueve": sin controles, sin sonido,
 * sin nada que tocar. Y sobre todo, sin gastar datos hasta que se va a ver —
 * `preload="none"` significa que el navegador no descarga ni un byte hasta que
 * alguien llama a `play()`, y aquí solo se llama cuando la pieza se acerca a la
 * pantalla. Un book con seis vídeos que se descargaran de golpe al abrir sería
 * un book que nadie termina de ver desde el móvil.
 *
 * Mientras tanto se ve el PÓSTER (el primer fotograma, generado en el navegador
 * al subir el clip). Sin él, un vídeo sin descargar pinta un rectángulo negro.
 */
export function BookPiece({
  pieza,
  alt,
  sizes,
  priority = false,
  /** Deja que la pieza mande su proporción real. Las escenas de rejilla no, para
   *  que la cuadrícula salga pareja aunque las fotos vengan de sitios distintos. */
  usarRatio = true,
  className = "",
}: {
  pieza: PiezaBook;
  alt: string;
  sizes: string;
  priority?: boolean;
  usarRatio?: boolean;
  className?: string;
}) {
  // Margen generoso: se empieza a traer el vídeo cuando aún falta media pantalla,
  // así llega rodando en vez de arrancando delante de las narices.
  const { ref, onScreen } = useOnScreen<HTMLVideoElement>({
    rootMargin: "50% 0px",
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (onScreen) {
      // Puede rechazar (ahorro de batería, pestaña en segundo plano). No es un
      // error: se queda el póster, que es exactamente lo que debe verse.
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [onScreen, ref]);

  const estilo = usarRatio && pieza.ratio ? { aspectRatio: pieza.ratio } : undefined;
  const objectPosition =
    pieza.foco === "arriba" ? "top" : pieza.foco === "abajo" ? "bottom" : "center";

  if (pieza.tipo === "video") {
    return (
      <div className={`og-book-pieza ${className}`} style={estilo}>
        <video
          ref={ref}
          src={pieza.url}
          poster={pieza.poster}
          muted
          loop
          playsInline
          preload="none"
          // Decorativo: la pieza no comunica nada que no diga ya su texto, y un
          // clip mudo en bucle anunciado por un lector de pantalla es ruido.
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition }}
        />
      </div>
    );
  }

  return (
    <div className={`og-book-pieza ${className}`} style={estilo}>
      <Image
        src={pieza.url}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
        style={{ objectPosition }}
      />
    </div>
  );
}
