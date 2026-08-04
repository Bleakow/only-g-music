"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { glassSurface } from "@/components/ui/glass";
import { SearchIcon, SparklesIcon, XIcon } from "@/components/icons";
import { ArtistCtaButton } from "./ArtistCtaButton";
import { DirectorySearchBar } from "./DirectorySearchBar";
import { useDirectorySearch } from "./DirectorySearchProvider";

/**
 * Acciones de la cabecera del directorio: el CTA de perfil y —solo en móvil— la
 * lupa que despliega el buscador justo debajo.
 *
 * En móvil el buscador no ocupa sitio hasta que se pide: antes, entre la barra,
 * su ayuda y dos chips de ejemplo, lo primero que veía quien entraba a ver
 * artistas era un formulario, y los artistas empezaban fuera de pantalla. En
 * escritorio la barra sigue fija dentro de la vitrina y aquí solo va el CTA.
 */
export function ArtistsHeaderActions() {
  const t = useTranslations("artistsPage");
  const { searchOpen, setSearchOpen, busquedaActiva } = useDirectorySearch();
  const inputRef = useRef<HTMLInputElement>(null);

  // Al desplegar, el cursor va al campo: si hay que tocar dos veces para
  // escribir, el botón no ha ahorrado nada.
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  return (
    <div className="mt-5">
      {/* La lupa se va al extremo derecho del contenido (no pegada al CTA): es
          una acción aparte y así el pulgar la tiene donde la espera. */}
      <div className="flex items-center justify-between gap-2">
        <ArtistCtaButton />
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          aria-expanded={searchOpen}
          aria-controls="directory-search-panel"
          aria-label={t(searchOpen ? "closeSearch" : "openSearch")}
          className={`${glassSurface} relative flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-95 sm:hidden ${
            searchOpen || busquedaActiva
              ? "text-amethyst-100 ring-amethyst-300/60"
              : "text-white/90"
          }`}
        >
          {searchOpen ? (
            <XIcon className="size-5" />
          ) : (
            <>
              <SearchIcon className="size-5" />
              {/* La chispa es la pista de que detrás hay IA, no un `LIKE %…%`. */}
              <SparklesIcon className="text-amethyst-300 absolute top-1.5 right-1.5 size-3" />
            </>
          )}
        </button>
      </div>

      {/* Revelado por altura con grid 0fr→1fr: anima sin saber cuánto mide el
          panel y sin un `max-height` inventado que recorte el contenido. */}
      <div
        id="directory-search-panel"
        inert={!searchOpen || undefined}
        className={`grid transition-all duration-300 ease-out sm:hidden ${
          searchOpen
            ? "mt-3 grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <DirectorySearchBar variant="compact" inputRef={inputRef} />
        </div>
      </div>
    </div>
  );
}
