"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getVisibleProfiles } from "@/features/artists/lib/artist-profile-repo";
import { CloseIcon } from "@/components/icons";
import { glassSurfaceMenu, glassSurfaceSoft } from "@/components/ui/glass";

interface Row {
  slug: string;
  name: string;
  image: string;
}

interface RelatedArtistsPickerProps {
  /** Slugs seleccionados (colaboradores destacados). */
  value: string[];
  onChange: (slugs: string[]) => void;
  /** El propio slug del artista, para no dejar que se enlace a sí mismo. */
  excludeSlug?: string;
}

const INPUT =
  "w-full rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80";

/**
 * Selector de artistas relacionados / colaboradores: el artista busca entre los
 * perfiles visibles de la plataforma y los añade como chips. Guarda solo **slugs**.
 * Mirroring del ArtistPicker de cotizaciones, pero: (1) emite slugs, no
 * QuoteCollaborator; (2) carga la lista visible UNA vez y filtra en cliente.
 */
export function RelatedArtistsPicker({
  value,
  onChange,
  excludeSlug,
}: RelatedArtistsPickerProps) {
  const t = useTranslations("profileBuilder.relatedArtists");
  const [all, setAll] = useState<Row[]>([]);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Una sola lectura de la vitrina; la búsqueda no vuelve a tocar la red.
  useEffect(() => {
    let active = true;
    getVisibleProfiles()
      .then((profiles) => {
        if (!active) return;
        setAll(
          profiles.map((p) => ({
            slug: p.slug,
            name: p.artisticName,
            image: p.photoURL,
          })),
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Cerrar el desplegable al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const bySlug = useMemo(() => new Map(all.map((r) => [r.slug, r])), [all]);

  const query = term.trim().toLowerCase();
  const results = all
    .filter((r) => r.slug !== excludeSlug && !value.includes(r.slug))
    .filter((r) => (query ? r.name.toLowerCase().includes(query) : true))
    .slice(0, 8);

  function add(slug: string) {
    if (value.includes(slug)) return;
    onChange([...value, slug]);
    setTerm("");
    setOpen(false);
  }

  function remove(slug: string) {
    onChange(value.filter((s) => s !== slug));
  }

  return (
    <div ref={ref} className="relative flex flex-col gap-3">
      <input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("searchPlaceholder")}
        className={INPUT}
      />

      {open && (
        <div
          className={`absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl p-1 ${glassSurfaceMenu}`}
        >
          {results.length === 0 ? (
            <p className="text-silver-400 px-3 py-2 text-sm">{t("empty")}</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.slug}>
                  <button
                    type="button"
                    onClick={() => add(r.slug)}
                    className="text-silver-100 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5 hover:text-white"
                  >
                    {r.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image}
                        alt=""
                        className="size-8 shrink-0 rounded-full object-cover"
                      />
                    )}
                    <span className="truncate">{r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((slug) => {
            const row = bySlug.get(slug);
            const label = row?.name ?? slug;
            return (
              <span
                key={slug}
                className={`text-silver-100 inline-flex items-center gap-2 rounded-full py-1 pr-2 pl-1.5 text-sm ${glassSurfaceSoft}`}
              >
                {row?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.image}
                    alt=""
                    className="size-6 rounded-full object-cover"
                  />
                ) : null}
                {label}
                <button
                  type="button"
                  onClick={() => remove(slug)}
                  aria-label={t("remove", { name: label })}
                  className="text-silver-400 flex size-7 items-center justify-center rounded-full transition hover:bg-white/10 hover:text-white"
                >
                  <CloseIcon className="size-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
