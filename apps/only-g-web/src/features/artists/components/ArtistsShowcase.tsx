"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import { useTranslations } from "next-intl";
import type { Artist } from "@only-g/shared-types/artist";
import type { Role } from "@only-g/shared-types/user";
import {
  PERFORMER_ROLES,
  PRODUCTION_ROLES,
  DIRECTORY_ROLES,
  disciplinesOf,
  matchesQuery,
  type MacroFilter,
} from "@only-g/shared-types/talent-directory";
import { glassSurface } from "@/components/ui/glass";
import {
  SearchIcon,
  SparklesIcon,
  XIcon,
  LayoutGridIcon,
  SlidersIcon,
  MicIcon,
  DiscIcon,
  ActivityIcon,
  MegaphoneIcon,
  CameraIcon,
  AudioLinesIcon,
} from "@/components/icons";
import { getVisibleProfiles } from "../lib/artist-profile-repo";
import { profileToArtist } from "../lib/profile-display";
import { searchArtistsAI } from "../lib/ai-search";
import { ArtistGrid } from "./ArtistGrid";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

// Degradado de marca del .pen (§03): amatista claro → intenso.
const SEARCH_BAR = `${glassSurface} flex items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-4`;
const AI_BUTTON =
  "font-narrow flex shrink-0 items-center gap-2 rounded-xl bg-linear-to-b from-[#a87bff] to-[#7c3aed] px-4 py-3 text-sm font-bold tracking-wide text-white uppercase shadow-[0_6px_22px_rgba(124,58,237,0.55)] ring-1 ring-inset ring-amethyst-300/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
const SUGGESTION_CHIP =
  "flex shrink-0 items-center gap-1.5 rounded-full bg-amethyst-500/[0.12] px-3.5 py-1.5 text-[0.8rem] text-amethyst-100 ring-1 ring-inset ring-amethyst-300/30 backdrop-blur-md transition hover:bg-amethyst-500/20";
const MACRO_WRAP =
  "inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-[#0a0712cc] p-1.5 ring-1 ring-inset ring-white/15 backdrop-blur-md";
const MACRO_BASE =
  "font-narrow flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold tracking-[2px] uppercase transition sm:px-5";
const MACRO_ON =
  "bg-linear-to-b from-[#a87bff] to-[#7c3aed] text-white shadow-[0_4px_16px_rgba(124,58,237,0.5)]";
const MACRO_OFF = "text-silver-300 hover:text-white";
const CHIP_BASE =
  "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[0.8rem] font-semibold ring-1 ring-inset backdrop-blur-md transition";
const CHIP_ON = "bg-amethyst-500/25 text-white ring-amethyst-300/60";
const CHIP_OFF =
  "bg-white/10 text-silver-100 ring-white/20 hover:text-white hover:ring-white/35";

// Icono por disciplina (fila de chips): performers + producción.
const ROLE_ICON: Partial<Record<Role, IconType>> = {
  artista: MicIcon,
  dj: DiscIcon,
  bailarin: ActivityIcon,
  presentador: MegaphoneIcon,
  modelo: CameraIcon,
  beatmaker: AudioLinesIcon,
  productor: SlidersIcon,
};

/** ¿El conjunto de chips seleccionadas coincide exactamente con un grupo macro? */
function sameSet(sel: Set<Role>, group: Role[]): boolean {
  return sel.size === group.length && group.every((r) => sel.has(r));
}

/** Macro "activo" DERIVADO de las chips marcadas (preset). null = selección libre. */
function activeMacro(sel: Set<Role>): MacroFilter | null {
  if (sel.size === 0) return "todos";
  if (sameSet(sel, PERFORMER_ROLES)) return "escena";
  if (sameSet(sel, PRODUCTION_ROLES)) return "produccion";
  return null;
}

/**
 * Vitrina/directorio de artistas (§03 OGM.pen). El servidor pasa la semilla
 * (`fallback`) para SSR/SEO; en cliente cargamos los perfiles REALES visibles.
 *
 * Descubrimiento en capas, componible:
 *  1. Búsqueda: filtro de texto INSTANTÁNEO (cliente) o BÚSQUEDA IA (endpoint que
 *     entiende apariencia/voz/temática y devuelve slugs ordenados).
 *  2. Chips de disciplina (multi-selección). Los macro (Todos / En escena /
 *     Producción) son PRESETS que marcan el grupo de chips correspondiente.
 */
export function ArtistsShowcase({ fallback }: { fallback: Artist[] }) {
  const t = useTranslations("artistsPage");
  const [artists, setArtists] = useState<Artist[]>(fallback);
  const [loading, setLoading] = useState(fallback.length === 0);
  const [query, setQuery] = useState("");
  // Disciplinas marcadas (chips). Vacío = sin filtro de disciplina.
  const [roles, setRoles] = useState<Set<Role>>(new Set());
  // Búsqueda IA: null = filtro instantáneo; array (aun vacío) = modo IA (slugs).
  const [aiSlugs, setAiSlugs] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  // Invalida búsquedas IA en vuelo (si el usuario escribe o dispara otra).
  const reqId = useRef(0);

  useEffect(() => {
    let active = true;
    getVisibleProfiles()
      .then((profiles) => {
        if (!active || profiles.length === 0) return;
        setArtists(profiles.map(profileToArtist));
      })
      .catch(() => {
        /* sin perfiles reales o sin red: nos quedamos con la semilla */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const list = useMemo(() => {
    let base: Artist[];
    if (aiSlugs) {
      const order = new Map(aiSlugs.map((s, i) => [s, i]));
      base = artists
        .filter((a) => order.has(a.slug))
        .sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
    } else {
      base = artists.filter((a) => matchesQuery(a, query));
    }
    if (roles.size > 0) {
      base = base.filter((a) => disciplinesOf(a).some((r) => roles.has(r)));
    }
    return base;
  }, [artists, aiSlugs, query, roles]);

  const aiActive = aiSlugs !== null;

  async function runAiSearch(q?: string) {
    const term = (q ?? query).trim();
    if (term.length < 2) return;
    if (q !== undefined) setQuery(q);
    const id = ++reqId.current;
    setAiLoading(true);
    const { slugs } = await searchArtistsAI(term);
    if (reqId.current !== id) return; // una interacción más nueva la reemplazó
    setAiSlugs(slugs);
    setAiLoading(false);
  }

  function onQueryChange(v: string) {
    setQuery(v);
    reqId.current++; // escribir invalida la IA en vuelo y vuelve al filtro instantáneo
    if (aiActive) setAiSlugs(null);
    if (aiLoading) setAiLoading(false);
  }

  function clearSearch() {
    reqId.current++;
    setQuery("");
    setAiSlugs(null);
    setAiLoading(false);
  }

  function toggleRole(r: Role) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  function selectMacro(m: MacroFilter) {
    if (m === "todos") setRoles(new Set());
    else if (m === "escena") setRoles(new Set(PERFORMER_ROLES));
    else setRoles(new Set(PRODUCTION_ROLES));
  }

  return (
    <div className="space-y-6">
      <DirectorySearch
        query={query}
        aiLoading={aiLoading}
        onQueryChange={onQueryChange}
        onSearch={() => runAiSearch()}
        onSuggestion={(s) => runAiSearch(s)}
        onClear={clearSearch}
      />

      <DirectoryFilters
        roles={roles}
        macro={activeMacro(roles)}
        onToggleRole={toggleRole}
        onMacro={selectMacro}
      />

      {!loading && (
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-silver-400 text-sm">
            {t("count", { count: list.length })}
          </p>
          {aiActive && (
            <button
              type="button"
              onClick={clearSearch}
              className="text-amethyst-200 hover:text-amethyst-100 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase transition"
            >
              {t("aiResults")}
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonGrid />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <p className="font-narrow text-2xl font-bold text-white uppercase">
            {t("noResults")}
          </p>
          <p className="text-silver-400 text-sm">{t("noResultsHint")}</p>
        </div>
      ) : (
        // key: remonta el grid al cambiar el conjunto → re-dispara la animación de
        // entrada escalonada de las cards.
        <ArtistGrid key={list.map((a) => a.slug).join(",")} artists={list} />
      )}
    </div>
  );
}

/** Barra de búsqueda glass + botón IA + ayuda corta + 2 chips de sugerencia. */
function DirectorySearch({
  query,
  aiLoading,
  onQueryChange,
  onSearch,
  onSuggestion,
  onClear,
}: {
  query: string;
  aiLoading: boolean;
  onQueryChange: (v: string) => void;
  onSearch: () => void;
  onSuggestion: (s: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations("artistsPage");
  const suggestions = [t("aiSuggestion1"), t("aiSuggestion2")];
  const canSearch = query.trim().length >= 2 && !aiLoading;

  return (
    <div className="space-y-3">
      <div className={SEARCH_BAR}>
        <SearchIcon className="text-silver-400 size-5 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="placeholder:text-silver-500 min-w-0 flex-1 bg-transparent py-2.5 text-base text-white outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={onClear}
            aria-label={t("clearSearch")}
            className="text-silver-400 shrink-0 rounded-full p-1 transition hover:text-white"
          >
            <XIcon className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onSearch}
          disabled={!canSearch}
          className={AI_BUTTON}
        >
          <SparklesIcon className={`size-4 ${aiLoading ? "animate-pulse" : ""}`} />
          <span className="hidden sm:inline">
            {aiLoading ? t("aiSearching") : t("aiButton")}
          </span>
        </button>
      </div>

      <p className="text-silver-500 px-1 text-xs sm:text-sm">{t("aiHelper")}</p>

      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-silver-500 text-[0.65rem] font-semibold tracking-[2px] uppercase">
          {t("aiTry")}
        </span>
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className={SUGGESTION_CHIP}
          >
            <SparklesIcon className="size-3" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Filtros de disciplina. Desktop: chips a la izquierda, macro tabs en la esquina
 * derecha (misma fila) para no abrumar. Móvil: macro arriba, chips en un carrusel
 * horizontal deslizable (ahorra alto y deja los artistas como foco).
 */
function DirectoryFilters({
  roles,
  macro,
  onToggleRole,
  onMacro,
}: {
  roles: Set<Role>;
  macro: MacroFilter | null;
  onToggleRole: (r: Role) => void;
  onMacro: (m: MacroFilter) => void;
}) {
  const t = useTranslations("artistsPage");
  const tRoles = useTranslations("roles");

  const macros: { id: MacroFilter; label: string; Icon: IconType }[] = [
    { id: "todos", label: t("macroTodos"), Icon: LayoutGridIcon },
    { id: "escena", label: t("macroEscena"), Icon: SparklesIcon },
    { id: "produccion", label: t("macroProduccion"), Icon: SlidersIcon },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-start sm:justify-between sm:gap-6">
      <div role="tablist" aria-label={t("macroLabel")} className={MACRO_WRAP}>
        {macros.map(({ id, label, Icon }) => {
          const on = macro === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onMacro(id)}
              className={`${MACRO_BASE} ${on ? MACRO_ON : MACRO_OFF}`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label={t("roleLabel")}
        className="flex flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-1 sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {DIRECTORY_ROLES.map((r) => {
          const Icon = ROLE_ICON[r] ?? MicIcon;
          const on = roles.has(r);
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => onToggleRole(r)}
              className={`${CHIP_BASE} ${on ? CHIP_ON : CHIP_OFF}`}
            >
              <Icon className="size-3.5" />
              {tRoles(r)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Esqueleto del grid: pastillas glass con pulso mientras cargan los perfiles. */
function SkeletonGrid() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[4/5] animate-pulse overflow-hidden rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/10"
        >
          <div className="flex h-full flex-col justify-end gap-2 p-4">
            <div className="h-2 w-1/3 rounded-full bg-white/10" />
            <div className="h-4 w-2/3 rounded-full bg-white/15" />
          </div>
        </div>
      ))}
    </div>
  );
}
