import type { ReactNode } from "react";
import {
  CATALOG_BG_DESKTOP,
  CATALOG_BG_MOBILE,
} from "@/features/services/data/services";

/**
 * Fondo compartido de los catálogos /comprar y /cotizar: misma foto fija a
 * pantalla completa (con dirección de arte móvil/desktop) detrás de la wizard,
 * atenuada con `bg-ink/60` para que el texto se lea. Mismo patrón que
 * `AdminShell` (imagen `fixed inset-0 -z-10` + `isolate` para que el
 * backdrop-blur del cristal la frostee por encima).
 */
export function CatalogBackground({ children }: { children: ReactNode }) {
  return (
    <div className="bg-ink relative isolate min-h-dvh">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <picture>
          <source media="(max-width: 640px)" srcSet={CATALOG_BG_MOBILE} />
          <img
            src={CATALOG_BG_DESKTOP}
            alt=""
            className="size-full object-cover"
          />
        </picture>
        <div className="bg-ink/60 absolute inset-0" />
      </div>

      {children}
    </div>
  );
}
