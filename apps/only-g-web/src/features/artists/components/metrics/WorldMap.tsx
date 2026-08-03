"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { flagEmoji } from "@only-g/shared-types/profile-metrics";
import { formatCompact } from "@only-g/shared-types/artist-profile";
import { WORLD_PATHS, WORLD_VIEWBOX } from "./world-paths";

/**
 * Mapa mundial de visitas (§04). Coropleta + resplandor: los países con
 * visitantes se tiñen según intensidad y sueltan un halo, sobre una silueta
 * apagada del resto del mundo.
 *
 * Los polígonos vienen precomputados (`world-paths.ts`, generado por
 * `scripts/generate-world-map.mjs`), así que aquí no hay ni proyección ni
 * TopoJSON: solo cadenas `d` y color.
 */

/** Extremos de la rampa: morado profundo → amatista claro (los del mockup). */
const COLD = [0x3b, 0x07, 0x64] as const;
const HOT = [0xc4, 0xa5, 0xff] as const;

/** Color de la rampa para una intensidad 0–1. */
function ramp(tt: number): string {
  const c = Math.max(0, Math.min(1, tt));
  const ch = (i: number) => Math.round(COLD[i] + (HOT[i] - COLD[i]) * c);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

/**
 * Intensidad 0–1 de un país. Raíz cuadrada y no proporción directa: en la vida
 * real un país concentra el 80 % de las visitas, y en escala lineal todos los
 * demás quedarían negros e indistinguibles. La raíz levanta la cola sin mentir
 * sobre quién manda (el líder sigue siendo el único en 1).
 */
function intensity(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.sqrt(value / max);
}

export function WorldMap({
  porPais,
  className = "",
}: {
  /** Visitas por país ISO-2. */
  porPais: Record<string, number> | undefined;
  className?: string;
}) {
  const t = useTranslations("metrics");
  const locale = useLocale();
  const [hover, setHover] = useState<{
    iso: string;
    x: number;
    y: number;
  } | null>(null);

  const countryName = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([locale], { type: "region" });
      return (iso: string) => dn.of(iso) ?? iso;
    } catch {
      return (iso: string) => iso;
    }
  }, [locale]);

  const data = porPais ?? {};
  const max = Math.max(0, ...Object.values(data));
  const activos = Object.keys(data).filter(
    (iso) => data[iso] > 0 && WORLD_PATHS[iso],
  );

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={WORLD_VIEWBOX}
        className="h-auto w-full"
        role="img"
        aria-label={t("mapAria", { count: activos.length })}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          {/* El halo: una copia difuminada de los países encendidos. Es lo que
              da la sensación de "zonas alumbradas" en vez de manchas planas. */}
          <filter id="ogm-map-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* 1 · Silueta del mundo: contexto geográfico, sin protagonismo. */}
        <g fill="#1a1a22" stroke="#2a2a35" strokeWidth="0.4">
          {Object.entries(WORLD_PATHS).map(([iso, d]) => (
            <path key={iso} d={d} />
          ))}
        </g>

        {/* 2 · Resplandor de los países con visitas. */}
        <g filter="url(#ogm-map-glow)" opacity="0.75" aria-hidden="true">
          {activos.map((iso) => (
            <path
              key={iso}
              d={WORLD_PATHS[iso]}
              fill={ramp(intensity(data[iso], max))}
            />
          ))}
        </g>

        {/* 3 · Los mismos países, nítidos y sensibles al cursor. */}
        <g>
          {activos.map((iso) => (
            <path
              key={iso}
              d={WORLD_PATHS[iso]}
              fill={ramp(intensity(data[iso], max))}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="0.4"
              className="cursor-pointer transition-[filter] hover:brightness-125"
              onPointerMove={(e) => {
                const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                if (!box) return;
                setHover({
                  iso,
                  x: e.clientX - box.left,
                  y: e.clientY - box.top,
                });
              }}
              onPointerLeave={() => setHover(null)}
            >
              {/* Título nativo: da el dato a lectores de pantalla y al hover
                  táctil, donde no hay puntero que seguir. */}
              <title>{`${countryName(iso)}: ${data[iso]}`}</title>
            </path>
          ))}
        </g>
      </svg>

      {/* Tooltip propio: el `<title>` nativo tarda un segundo en salir y rompe
          el ritmo de un panel que se explora pasando el ratón por encima. */}
      {hover && (
        <span
          className="bg-ink-soft pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-[calc(100%+10px)] items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
          style={{ left: hover.x, top: hover.y }}
        >
          <span aria-hidden="true">{flagEmoji(hover.iso)}</span>
          <span>{countryName(hover.iso)}</span>
          <span className="text-amethyst-200 font-bold tabular-nums">
            {formatCompact(data[hover.iso])}
          </span>
        </span>
      )}

      {activos.length === 0 && (
        <p className="text-silver-500 absolute inset-0 flex items-center justify-center text-center text-xs">
          {t("emptyCountries")}
        </p>
      )}
    </div>
  );
}
