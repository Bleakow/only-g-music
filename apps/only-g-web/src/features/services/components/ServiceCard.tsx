"use client";

import type { ReactNode } from "react";
import type { Service } from "@only-g/shared-types/service";
import { GlassSheen } from "@/components/ui/glass";
import { CheckIcon } from "@/components/icons";

/**
 * Card de catálogo LIQUID GLASS — compartida entre /comprar y /cotizar (misma
 * presentación, mismas fotos de `service.image` desde Storage). Puramente de
 * presentación: qué badge mostrar sobre la foto (`indicator`) y qué controles
 * van bajo la línea (`children`, steppers/variantes) lo decide cada wizard, que
 * conserva su propia lógica de carrito/filtros (PURCHASABLE/QUOTABLE).
 *
 * El glow de "activo" vive en una capa aparte (`aria-hidden` overlay) en vez de
 * pisar el `ring-white/20` de `glassSurfaceSoft` con un segundo `ring-*`: dos
 * utilidades de Tailwind sobre el MISMO elemento que tocan la misma propiedad
 * (`--tw-ring-color`) no tienen un ganador determinista por orden en el
 * className — el orden real lo decide el orden de generación del stylesheet.
 * Un elemento separado evita el conflicto por construcción.
 */
export function ServiceCard({
  service,
  active,
  priceLabel,
  onSelect,
  indicator,
  children,
  className = "",
}: {
  service: Service;
  active: boolean;
  priceLabel: string;
  onSelect: () => void;
  /** Badge sobre la foto (esquina superior derecha): check de seleccionado,
   *  contador de variantes, etc. Lo compone el caller. */
  indicator?: ReactNode;
  /** Controles bajo la línea (steppers +/-, botón de variantes). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-ink/70 shadow-[0_10px_34px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-white/12 ring-inset backdrop-blur-xl transition hover:ring-white/35 ${className}`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-2xl shadow-[0_0_0_1.5px_rgba(196,165,255,0.8),0_0_28px_rgba(139,92,246,0.3)]"
        />
      )}
      <GlassSheen />

      <button
        type="button"
        onClick={onSelect}
        className="relative block w-full text-left"
      >
        {service.image && (
          <span className="relative block h-40 w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={service.image}
              alt=""
              className="size-full object-cover transition duration-500 ease-out group-hover:scale-[1.06]"
            />
            <span className="from-ink via-ink/10 absolute inset-0 bg-linear-to-t to-transparent" />
            {indicator && (
              <span className="absolute top-3 right-3">{indicator}</span>
            )}
          </span>
        )}
        <span className="relative block px-4 py-4">
          <span className="font-narrow block text-xl leading-tight font-bold text-white uppercase">
            {service.name}
          </span>
          <span className="text-silver-300 mt-1 block text-sm">
            {service.description}
          </span>
          <span className="text-amethyst-200 mt-2 block text-sm font-semibold">
            {priceLabel}
          </span>
        </span>
      </button>

      {children && (
        <div className="relative border-t border-white/10 px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

/** Badge check para el estado "seleccionado" (servicios sin variantes). */
export function ServiceCheckBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-full border backdrop-blur-md transition ${
        active
          ? "border-amethyst-300 bg-amethyst-300 text-ink shadow-[0_0_12px_rgba(168,123,255,0.6)]"
          : "border-white/40 bg-black/20 text-transparent"
      }`}
    >
      <CheckIcon className="size-4" />
    </span>
  );
}
