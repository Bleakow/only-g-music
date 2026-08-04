"use client";

import Image from "next/image";
import {
  areaDeRanura,
  layoutEfectivo,
  type GalleryLayoutId,
} from "@only-g/shared-types/gallery-layout";
import type { GalleryItem } from "@only-g/shared-types/artist-profile";

/**
 * El MOSAICO de la galería: la misma pieza que se ve en el perfil público, en el
 * editor y en las miniaturas del selector de plantilla. Una sola implementación
 * para que "lo que armas es lo que se ve" sea verdad y no una promesa.
 *
 * La geometría entera está en CSS (`.og-gal[data-layout=…]`, globals.css); aquí
 * solo se colocan las fotos en sus ranuras. El contenedor declara el container
 * query, así que el mosaico se adapta al ANCHO QUE TIENE, no al del dispositivo:
 * en el editor (columna) y en el perfil (media pantalla) enseña lo mismo.
 */
export function GalleryMosaic({
  items,
  layout,
  className,
  children,
  renderItem,
}: {
  items: GalleryItem[];
  layout: GalleryLayoutId | null | undefined;
  className?: string;
  /** Contenido extra dentro de la grid (p. ej. los controles del editor). */
  children?: React.ReactNode;
  /** Cómo se pinta cada foto. Por defecto, la imagen a sangre. */
  renderItem?: (item: GalleryItem, index: number) => React.ReactNode;
}) {
  const efectivo = layoutEfectivo(layout, items.length);
  if (!efectivo) return null;

  return (
    <div className={`og-gal-wrap ${className ?? ""}`}>
      <div className="og-gal" data-layout={efectivo}>
        {items.map((item, i) => (
          <div
            key={item.url}
            style={{ gridArea: areaDeRanura(i) }}
            className="relative overflow-hidden rounded-xl border border-white/10 bg-neutral-950"
          >
            {renderItem ? (
              renderItem(item, i)
            ) : (
              <Image
                src={item.url}
                alt=""
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            )}
          </div>
        ))}
        {children}
      </div>
    </div>
  );
}

/**
 * Miniatura de una plantilla para el selector: la MISMA grid con las celdas
 * vacías. Dibujar aparte un iconito de cada composición garantizaría que tarde o
 * temprano el icono y el mosaico real dejaran de parecerse.
 */
export function GalleryLayoutThumb({
  layout,
  slots,
}: {
  layout: GalleryLayoutId;
  slots: number;
}) {
  return (
    // Ancho corto a propósito: al ser un container query, la miniatura enseña la
    // composición ESTRECHA — la que verá quien mire el perfil desde el móvil.
    <div className="og-gal-wrap w-14">
      <div className="og-gal" data-layout={layout} data-thumb aria-hidden="true">
        {Array.from({ length: slots }, (_, i) => (
          <div
            key={i}
            style={{ gridArea: areaDeRanura(i) }}
            className="rounded-[3px] bg-current opacity-70"
          />
        ))}
      </div>
    </div>
  );
}
