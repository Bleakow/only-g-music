import { VinylLoader } from "@/components/loaders/VinylLoader";

/**
 * Pantalla de carga para las páginas del grupo (site). Al vivir más cerca de
 * estas rutas, cubre las navegaciones entre ellas (artistas, productores,
 * cotizar, etc.) mostrando el vinilo mientras cargan.
 */
export default function Loading() {
  return <VinylLoader />;
}
