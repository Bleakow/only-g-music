import { VinylLoader } from "@/components/loaders/VinylLoader";

/**
 * Pantalla de carga por defecto (convención `loading.tsx` de Next). Se muestra
 * como fallback de Suspense mientras cualquier ruta bajo [locale] se carga
 * (navegaciones/redirecciones y render inicial con trabajo asíncrono).
 */
export default function Loading() {
  return <VinylLoader />;
}
