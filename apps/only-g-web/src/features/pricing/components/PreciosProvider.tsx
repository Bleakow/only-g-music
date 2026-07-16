"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DEFAULTS, type Precios } from "@only-g/shared-types/comercial-config";
import { getPrecios } from "../lib/precios-repo";

/**
 * Provee los PRECIOS vigentes (config comercial) a todo el árbol del cliente, de
 * modo que el DISPLAY del comprador coincida con lo que el servidor cobrará. Se
 * monta ALTO (junto a AuthProvider). Mientras carga —o si la lectura falla
 * (anónimo/offline)— entrega los `DEFAULTS`, así ningún precio se rompe ni
 * parpadea a 0. El server sigue siendo autoritativo del monto real.
 *
 * Patrón espejo de AuthProvider: un contexto de solo lectura + un hook. No lleva
 * lógica de negocio (esa vive en el dominio/repos): solo carga y expone datos.
 */
interface PreciosState {
  precios: Precios;
  /** true mientras se resuelve la primera lectura (útil para skeletons de precio). */
  loading: boolean;
}

const PreciosContext = createContext<PreciosState | undefined>(undefined);

export function PreciosProvider({ children }: { children: ReactNode }) {
  const [precios, setPrecios] = useState<Precios>(DEFAULTS.precios);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPrecios()
      .then((p) => {
        if (active) setPrecios(p);
      })
      .catch(() => {
        // Anónimo / sin red / reglas: conservamos los defaults (ya en estado).
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PreciosContext.Provider value={{ precios, loading }}>
      {children}
    </PreciosContext.Provider>
  );
}

/**
 * Precios vigentes para el display. Fuera del provider devuelve los DEFAULTS (no
 * lanza): así un componente aislado —o un test— sigue mostrando un precio válido.
 */
export function usePrecios(): Precios {
  const ctx = useContext(PreciosContext);
  return ctx?.precios ?? DEFAULTS.precios;
}
