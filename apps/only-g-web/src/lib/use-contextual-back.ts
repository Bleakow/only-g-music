import { useCallback } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * "Atrás" contextual: RETROCEDE a donde se venía en vez de empujar una ruta fija.
 *
 * Empujar la ruta padre con un `Link` parece equivalente, pero deja en la pila la
 * pantalla de la que sales: el siguiente "atrás" te devuelve a ella y quedas
 * dando vueltas (el bucle perfil ⇄ métricas). Retrocediendo de verdad, la pila no
 * crece y el botón del navegador y el de la app dicen lo mismo.
 *
 * `fallback` cubre la entrada directa —enlace compartido, pestaña nueva—, donde
 * no hay historial propio al que volver.
 */
export function useContextualBack(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router, fallback]);
}
