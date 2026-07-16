/**
 * Bloque placeholder con animación de pulso: imita la forma del contenido
 * real mientras carga, para evitar el salto visual al llegar los datos.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/10 ${className ?? ""}`}
    />
  );
}

/**
 * Azúcar sobre `Skeleton` para una línea de texto placeholder; usa
 * `className` para controlar el ancho (p. ej. `w-1/3`).
 */
export function SkeletonText({ className }: { className?: string }) {
  return (
    <div
      className={`h-4 animate-pulse rounded bg-white/10 ${className ?? ""}`}
    />
  );
}
