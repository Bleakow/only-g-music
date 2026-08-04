"use client";

import type { Ref } from "react";
import { useTranslations } from "next-intl";
import { glassSurface } from "@/components/ui/glass";
import { SearchIcon, SparklesIcon, XIcon } from "@/components/icons";
import { useDirectorySearch } from "./DirectorySearchProvider";

// Degradado de marca del .pen (§03): amatista claro → intenso.
const SEARCH_BAR = `${glassSurface} flex items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-4`;
const AI_BUTTON =
  "font-narrow flex shrink-0 items-center gap-2 rounded-xl bg-linear-to-b from-[#a87bff] to-[#7c3aed] px-4 py-3 text-sm font-bold tracking-wide text-white uppercase shadow-[0_6px_22px_rgba(124,58,237,0.55)] ring-1 ring-inset ring-amethyst-300/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
const SUGGESTION_CHIP =
  "flex shrink-0 items-center gap-1.5 rounded-full bg-amethyst-500/[0.12] px-3.5 py-1.5 text-[0.8rem] text-amethyst-100 ring-1 ring-inset ring-amethyst-300/30 backdrop-blur-md transition hover:bg-amethyst-500/20";

/**
 * Barra de búsqueda glass + botón IA.
 *
 * `full` (escritorio) trae además la ayuda y dos chips de ejemplo. `compact` —el
 * panel que se despliega en móvil— va sin ellos: ahí el alto es de los artistas,
 * y quien acaba de abrir el buscador a propósito no necesita que le expliquen
 * para qué sirve. Lo que sí queda es el placeholder, que ya pide una descripción,
 * y el botón de IA con su nombre.
 */
export function DirectorySearchBar({
  variant = "full",
  inputRef,
}: {
  variant?: "full" | "compact";
  inputRef?: Ref<HTMLInputElement>;
}) {
  const t = useTranslations("artistsPage");
  const { query, aiLoading, onQueryChange, runAiSearch, clearSearch } =
    useDirectorySearch();
  const suggestions = [t("aiSuggestion1"), t("aiSuggestion2")];
  const canSearch = query.trim().length >= 2 && !aiLoading;
  const compact = variant === "compact";

  return (
    <div className="space-y-3">
      <div className={SEARCH_BAR}>
        <SearchIcon className="text-silver-400 size-5 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runAiSearch();
          }}
          placeholder={t(compact ? "searchPlaceholderAi" : "searchPlaceholder")}
          aria-label={t("searchPlaceholderAi")}
          className="placeholder:text-silver-500 min-w-0 flex-1 bg-transparent py-2.5 text-base text-white outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label={t("clearSearch")}
            className="text-silver-400 shrink-0 rounded-full p-1 transition hover:text-white"
          >
            <XIcon className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => runAiSearch()}
          disabled={!canSearch}
          className={AI_BUTTON}
        >
          <SparklesIcon
            className={`size-4 ${aiLoading ? "animate-pulse" : ""}`}
          />
          {/* El nombre del botón se ve siempre en el panel compacto (es la pista
              de que hay IA detrás) y desde `sm` en la barra completa. */}
          <span className={compact ? "" : "hidden sm:inline"}>
            {aiLoading ? t("aiSearching") : t("aiButton")}
          </span>
        </button>
      </div>

      {!compact && (
        <>
          <p className="text-silver-500 px-1 text-xs sm:text-sm">
            {t("aiHelper")}
          </p>

          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="text-silver-500 text-[0.65rem] font-semibold tracking-[2px] uppercase">
              {t("aiTry")}
            </span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => runAiSearch(s)}
                className={SUGGESTION_CHIP}
              >
                <SparklesIcon className="size-3" />
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
