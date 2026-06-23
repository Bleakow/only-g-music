import type { ReactNode } from "react";
import { glassSurface, GlassSheen } from "./glass";

/**
 * Contenedor "Liquid Glass" (nuestra receta, ver ./glass). Presentacional: sirve
 * tanto en server como en client components.
 */
export function GlassCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${glassSurface} rounded-3xl p-5 ${className ?? ""}`}>
      <GlassSheen />
      <div className="relative">{children}</div>
    </div>
  );
}
