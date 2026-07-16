"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { searchArtists } from "@/features/artists/lib/artists-repo";
import { CloseIcon } from "@/components/icons";
import type { Artist } from "@only-g/shared-types/artist";
import type { QuoteCollaborator } from "@only-g/shared-types/quote";

const INPUT =
  "w-full rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80";

/**
 * Selector de artistas invitados: busca **a medida que escribes** y muestra las
 * coincidencias (no vuelca todos al enfocar). "Ver todos" es una opción
 * explícita de respaldo. Solo permite artistas del roster/registrados (hoy
 * placeholder vía searchArtists; mismo contrato al migrar a usuarios con rol
 * "artista"). Los seleccionados quedan como chips.
 */
export function ArtistPicker({
  value,
  onChange,
}: {
  value: QuoteCollaborator[];
  onChange: (collaborators: QuoteCollaborator[]) => void;
}) {
  const t = useTranslations();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const query = term.trim();
  const visible = open && (showAll || query.length > 0);

  // Búsqueda con debounce: solo cuando hay término escrito o se pidió "ver todos".
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      const r = await searchArtists(showAll ? "" : query, showAll ? 30 : 8);
      if (active) {
        setResults(r);
        setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, showAll, visible]);

  // Cerrar al clic fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selectedIds = new Set(value.map((c) => c.id));
  const list = results.filter((a) => !selectedIds.has(a.slug));

  function add(a: Artist) {
    if (selectedIds.has(a.slug)) return;
    onChange([
      ...value,
      { id: a.slug, name: a.name, ...(a.image ? { image: a.image } : {}) },
    ]);
    setTerm("");
    setShowAll(false);
    setOpen(false);
  }

  function remove(id: string) {
    onChange(value.filter((c) => c.id !== id));
  }

  return (
    <div ref={ref} className="relative flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setShowAll(false);
            setOpen(true);
          }}
          onFocus={() => {
            if (term.trim()) setOpen(true);
          }}
          placeholder={t("artistPicker.placeholder")}
          className={INPUT}
        />
        <button
          type="button"
          onClick={() => {
            setTerm("");
            setShowAll(true);
            setOpen(true);
          }}
          className="shrink-0 rounded-lg border border-amethyst-400/60 px-4 py-2.5 text-sm font-semibold uppercase tracking-[1px] text-amethyst-200 transition hover:border-amethyst-300 hover:bg-amethyst-500/10 hover:text-white"
        >
          {t("artistPicker.seeAll")}
        </button>
      </div>

      {visible && (
        <div className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-white/10 bg-ink-soft p-1 shadow-2xl">
          {loading ? (
            <p className="px-3 py-2 text-sm text-silver-400">
              {t("artistPicker.searching")}
            </p>
          ) : list.length === 0 ? (
            <p className="px-3 py-2 text-sm text-silver-400">
              {query
                ? t("artistPicker.noMatches")
                : t("artistPicker.noneRegistered")}
            </p>
          ) : (
            <ul>
              {list.map((a) => (
                <li key={a.slug}>
                  <button
                    type="button"
                    onClick={() => add(a)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-silver-100 transition hover:bg-white/5 hover:text-white"
                  >
                    {a.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.image}
                        alt=""
                        className="size-8 shrink-0 rounded-full object-cover"
                      />
                    )}
                    <span className="truncate">{a.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1.5 pr-2 text-sm text-silver-100"
            >
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.image}
                  alt=""
                  className="size-6 rounded-full object-cover"
                />
              ) : null}
              {c.name}
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label={t("artistPicker.remove", { name: c.name })}
                className="flex size-7 items-center justify-center rounded-full text-silver-400 transition hover:bg-white/10 hover:text-white"
              >
                <CloseIcon className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
