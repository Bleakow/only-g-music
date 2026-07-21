import type { ReactNode } from "react";
import {
  CATALOG_BG_DESKTOP,
  CATALOG_BG_MOBILE,
} from "@/features/services/data/services";

/**
 * Fondo de página a pantalla completa (con dirección de arte móvil/desktop)
 * atenuado con `bg-ink/60` para que el texto se lea. Por defecto usa la foto del
 * catálogo (/comprar y /cotizar); `desktop`/`mobile` permiten reutilizarlo con
 * otra imagen (p. ej. "Mis cosas"). Mismo patrón que `AdminShell` (imagen
 * `fixed inset-0 -z-10` + `isolate` para que el backdrop-blur del cristal la
 * frostee por encima).
 */
export function CatalogBackground({
  children,
  desktop = CATALOG_BG_DESKTOP,
  mobile = CATALOG_BG_MOBILE,
}: {
  children: ReactNode;
  desktop?: string;
  mobile?: string;
}) {
  return (
    <div className="bg-ink relative isolate min-h-dvh">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <picture>
          <source media="(max-width: 640px)" srcSet={mobile} />
          <img src={desktop} alt="" className="size-full object-cover" />
        </picture>
        <div className="bg-ink/60 absolute inset-0" />
      </div>

      {children}
    </div>
  );
}
