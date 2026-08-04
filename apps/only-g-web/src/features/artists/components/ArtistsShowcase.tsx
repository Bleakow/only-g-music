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
import {
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
import { ArtistGrid } from "./ArtistGrid";
import { DirectorySearchBar } from "./DirectorySearchBar";
import { useDirectorySearch } from "./DirectorySearchProvider";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

// `self-center` en móvil: el riel de artes de debajo ocupa todo el ancho, así que
// las pestañas pegadas a la izquierda quedaban descolgadas. En `sm` vuelven a su
// esquina (la fila se invierte y van a la derecha de los chips).
const MACRO_WRAP =
  "inline-flex shrink-0 items-center gap-1 self-center rounded-full bg-[#0a0712cc] p-1.5 ring-1 ring-inset ring-white/15 backdrop-blur-md sm:self-start";
/** Caja del riel de artes: mismo backing que las pestañas de área (móvil). */
const RAIL_BOX =
  "bg-[#0a0712cc] ring-1 ring-inset ring-white/12 backdrop-blur-md";
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
  // Disciplinas marcadas (chips). Vacío = sin filtro de disciplina.
  const [roles, setRoles] = useState<Set<Role>>(new Set());
  // La BÚSQUEDA vive en el provider: su botón está en la cabecera, que es otra
  // rama del árbol (ver DirectorySearchProvider).
  const { query, aiSlugs, clearSearch } = useDirectorySearch();

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
      {/* ESCRITORIO: la barra completa, con la ayuda y los ejemplos. En móvil el
          buscador se despliega desde la lupa de la cabecera (ArtistsHeaderActions):
          antes, entre barra, ayuda y chips de ejemplo, lo primero que veía quien
          entraba a ver artistas era un formulario. */}
      <div className="hidden sm:block">
        <DirectorySearchBar />
      </div>

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
  const railRef = useRef<HTMLDivElement>(null);
  // Qué extremos del riel están "tocados". Arranca en true/true: sin overflow no
  // se desvanece nada (es el caso de escritorio, donde los chips van en varias
  // filas y no hay carrusel).
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdges({
        start: el.scrollLeft <= 1,
        // `max <= 1` cubre el caso sin overflow: no hay nada cortado por ningún
        // lado y el riel se pinta entero.
        end: max <= 1 || el.scrollLeft >= max - 1,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    // El overflow depende del ancho: al girar el móvil o cambiar de breakpoint
    // hay que recalcular, o el degradado se queda mintiendo.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  // Máscara del riel: transparente por el lado donde queda contenido oculto.
  const mask = `linear-gradient(to right, ${
    edges.start ? "black" : "transparent"
  } 0, black 28px, black calc(100% - 28px), ${
    edges.end ? "black" : "transparent"
  } 100%)`;

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

      {/* Riel de artes. En móvil no caben todas, y antes se cortaban a media
          chip contra el borde de la pantalla: parecía un fallo de maquetación,
          no algo deslizable. Ahora van dentro de una caja con el mismo lenguaje
          que las pestañas de área, y el lado por el que queda contenido se
          DESVANECE — un chip a medio desaparecer sí se lee como "hay más". */}
      <div
        className={`relative rounded-full p-1.5 ${RAIL_BOX} sm:flex-1 sm:rounded-none sm:bg-transparent sm:p-0 sm:ring-0 sm:backdrop-blur-none`}
      >
        <div
          ref={railRef}
          role="group"
          aria-label={t("roleLabel")}
          style={{ maskImage: mask, WebkitMaskImage: mask }}
          className="flex snap-x flex-nowrap gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
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
                className={`${CHIP_BASE} snap-start ${on ? CHIP_ON : CHIP_OFF}`}
              >
                <Icon className="size-3.5" />
                {tRoles(r)}
              </button>
            );
          })}
        </div>
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
