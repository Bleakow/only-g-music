import { INSIGNIA_META, insigniaDePuntos } from "@/domain/artist-profile";

/**
 * Píldora de insignia (Plata/Oro/Diamante) derivada de los puntos. Server
 * Component: sin estado, solo presentación. El color sale de INSIGNIA_META.
 */
export function InsigniaBadge({
  puntos,
  className = "",
}: {
  puntos: number;
  className?: string;
}) {
  const meta = INSIGNIA_META[insigniaDePuntos(puntos)];
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
      {meta.label}
    </span>
  );
}
