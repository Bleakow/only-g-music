"use client";

import { useTranslations } from "next-intl";
import { INSIGNIA_META, insigniaDePuntos } from "@/domain/artist-profile";

/**
 * Píldora de insignia (Plata/Oro/Diamante) derivada de los puntos. El label se
 * traduce vía i18n (namespace `insignia`); el color sale de INSIGNIA_META.
 */
export function InsigniaBadge({
  puntos,
  className = "",
}: {
  puntos: number;
  className?: string;
}) {
  const t = useTranslations();
  const insignia = insigniaDePuntos(puntos);
  const meta = INSIGNIA_META[insignia];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[2px] ${className}`}
      style={{
        color: meta.color,
        borderColor: `${meta.color}66`,
        backgroundColor: `${meta.color}1a`,
      }}
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {t(`insignia.${insignia}`)}
    </span>
  );
}
