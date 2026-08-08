"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { DesintegradoId } from "@only-g/shared-types/book";
import {
  armandoEn,
  construirPolvo,
  fasePolvo,
  urlYaCargada,
  type Polvo,
} from "../lib/desintegrar";

/**
 * VISTA PREVIA del desintegrado, en bucle.
 *
 * Es la misma petición que ya hizo el usuario con las miniaturas de escena, y
 * por el mismo motivo: cinco nombres en una fila de botones —"arena",
 * "remolino", "ceniza"— no le dicen a nadie qué va a ver. Y aquí pesa más
 * todavía, porque el desintegrado es un MOVIMIENTO: en estático las cinco
 * opciones son la misma foto.
 *
 * Usa EL MOTOR DE VERDAD, no una imitación. Es el mismo argumento que dejó
 * escrito `GalleryLayoutThumb`: un dibujo aparte y la cosa real acaban
 * divergiendo siempre, y aquí la divergencia sería mentirle a la modelo sobre lo
 * que está eligiendo. Lo único que cambia es el reloj: en el book lo mueve el
 * scroll y aquí un bucle, porque en el editor no hay recorrido que arrastrar.
 *
 * CON SU PROPIA FOTO. Sale la de portada del book, no una de muestra: media
 * gracia del efecto es cómo queda con la imagen que va a llevar. Si todavía no
 * la ha subido, se dice — mejor que enseñar un efecto sobre algo que no es suyo.
 */

/** Lo que tarda una vuelta completa: se arma, se queda, se deshace. */
const CICLO = 6500;

/** Descanso entre vueltas, para que el ojo llegue a ver la foto entera. */
const PAUSA = 1200;

export function DesintegradoPreview({
  url,
  desintegrado,
}: {
  url?: string;
  desintegrado: DesintegradoId;
}) {
  const t = useTranslations("bookEditor.atmosfera");
  const marco = useRef<HTMLDivElement>(null);
  const capa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const m = marco.current;
    const c = capa.current;
    const img = m?.querySelector("img");
    if (!url || !m || !c || !img) return;

    let vivo = true;
    let polvo: Polvo | null = null;
    let cuadro = 0;
    let inicio = 0;

    // Quien pide menos movimiento se queda con la foto quieta. No es apagar la
    // vista previa: la foto SÍ es lo que va a ver, solo que sin el bucle.
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    void urlYaCargada(img)
      .then((u) => (u ? construirPolvo(m, c, img, u, desintegrado) : null))
      .then((p) => {
        if (!vivo || !p) return;
        polvo = p;
        // La foto del DOM se apaga en cuanto el lienzo existe. Si el lienzo no
        // se pudo montar, se queda ella — que es una foto perfecta.
        img.style.visibility = "hidden";

        if (quieto) {
          p.pintar(0, true);
          return;
        }

        const bucle = (ahora: number) => {
          if (!inicio) inicio = ahora;
          const vuelta = (ahora - inicio) % (CICLO + PAUSA);
          // Durante la pausa se congela en el final del ciclo, que es la foto
          // deshecha… y como el ciclo empieza armándola, el descanso cae justo
          // donde no se ve nada. Se pinta el 0 para que la pausa sea la foto
          // ENTERA, que es lo que hay que mirar.
          const paso = vuelta > CICLO ? 0 : vuelta / CICLO;
          p.pintar(fasePolvo(paso), armandoEn(paso));
          cuadro = requestAnimationFrame(bucle);
        };
        cuadro = requestAnimationFrame(bucle);
      });

    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      polvo?.destruir();
      // Devuelve la foto a la vista: al cambiar de efecto el nodo se reutiliza,
      // y sin esto el siguiente montaje arrancaría sobre una imagen invisible.
      if (img) img.style.visibility = "";
    };
    // El efecto se remonta ENTERO al cambiar de receta: son otras partículas y
    // otros vuelos, y reconstruirlo es más barato y más honesto que parchearlo.
  }, [url, desintegrado]);

  if (!url) {
    return (
      <p className="text-silver-500 mt-2 text-xs">{t("desintegradoSinFoto")}</p>
    );
  }

  return (
    // La caja de fuera RECORTA: el lienzo se sale del marco por donde vuelan las
    // partículas, y sin ella la arena se pasearía por encima del editor.
    <div className="og-book-desint-vista">
      <div ref={marco} className="og-book-desint-vista-marco">
        <Image
          src={url}
          alt=""
          fill
          // Por `next/image` y no por la url de Storage a propósito: el lienzo
          // tiene que LEER los píxeles de la foto, y una imagen de otro dominio
          // lo contamina y `getImageData` lanza. `/_next/image` es mismo origen.
          sizes="220px"
          className="object-cover"
        />
        {/* Aquí cuelga el lienzo, y su caja se mide en porcentajes de ESTA capa:
            tiene que ser hija del marco, no hermana. */}
        <div ref={capa} className="og-book-desint" />
      </div>
    </div>
  );
}
