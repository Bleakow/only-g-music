"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { searchArtistsAI } from "../lib/ai-search";

/**
 * Estado de la BÚSQUEDA del directorio (§03), compartido por dos zonas de la
 * página que no son parientes: el botón-lupa vive en la cabecera, junto al CTA
 * de perfil, y la cuadrícula que filtra está más abajo, en `ArtistsShowcase`.
 *
 * La página es un Server Component, así que el estado no puede vivir en ella:
 * este provider la envuelve y ambas piezas lo consumen. Es lo único que se
 * comparte — los artistas los sigue cargando la vitrina.
 */
interface DirectorySearch {
  query: string;
  /** Resultado de la IA: null = filtro instantáneo de texto; array = modo IA. */
  aiSlugs: string[] | null;
  aiLoading: boolean;
  /** ¿Hay algún filtro de búsqueda puesto? (la lupa se enciende con esto). */
  busquedaActiva: boolean;
  /** Panel desplegado (solo aplica en móvil; en escritorio la barra va fija). */
  searchOpen: boolean;
  setSearchOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  onQueryChange: (v: string) => void;
  runAiSearch: (q?: string) => void;
  clearSearch: () => void;
}

const Ctx = createContext<DirectorySearch | null>(null);

export function useDirectorySearch(): DirectorySearch {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useDirectorySearch fuera de <DirectorySearchProvider>");
  }
  return ctx;
}

export function DirectorySearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [aiSlugs, setAiSlugs] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Invalida búsquedas IA en vuelo (si se escribe o se dispara otra).
  const reqId = useRef(0);

  const runAiSearch = useCallback(
    async (q?: string) => {
      const term = (q ?? query).trim();
      if (term.length < 2) return;
      if (q !== undefined) setQuery(q);
      const id = ++reqId.current;
      setAiLoading(true);
      const { slugs } = await searchArtistsAI(term);
      if (reqId.current !== id) return; // una interacción más nueva la reemplazó
      setAiSlugs(slugs);
      setAiLoading(false);
    },
    [query],
  );

  const onQueryChange = useCallback((v: string) => {
    setQuery(v);
    reqId.current++; // escribir invalida la IA en vuelo y vuelve al filtro instantáneo
    setAiSlugs(null);
    setAiLoading(false);
  }, []);

  const clearSearch = useCallback(() => {
    reqId.current++;
    setQuery("");
    setAiSlugs(null);
    setAiLoading(false);
  }, []);

  const value = useMemo<DirectorySearch>(
    () => ({
      query,
      aiSlugs,
      aiLoading,
      busquedaActiva: aiSlugs !== null || query.trim().length > 0,
      searchOpen,
      setSearchOpen,
      onQueryChange,
      runAiSearch,
      clearSearch,
    }),
    [query, aiSlugs, aiLoading, searchOpen, onQueryChange, runAiSearch, clearSearch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
