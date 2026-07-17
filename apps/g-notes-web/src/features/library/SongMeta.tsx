"use client";

import { useMemo } from "react";
import { SearchableSelect, type SelectOption } from "@only-g/ui";
import { COMPACT_SELECT } from "@/components/ui";
import {
  GENRES,
  KIND_LABEL,
  SONG_STATES,
  STATE_DOT,
  STATE_LABEL,
  type Genre,
  type Library,
  type Song,
  type SongState,
} from "@/features/library/types";

const STATE_OPTIONS: SelectOption[] = SONG_STATES.map((s) => ({
  value: s,
  label: STATE_LABEL[s],
}));

const GENRE_OPTIONS: SelectOption[] = [
  { value: "", label: "Sin género" },
  ...GENRES.map((g) => ({ value: g, label: g })),
];

/**
 * Barra de metadata de la canción activa: estado · género · álbum · listas.
 * Todos los controles reutilizan el SearchableSelect de @only-g/ui en tamaño
 * compacto. Las listas son many-to-many (chips + añadir/crear).
 */
export function SongMeta({
  song,
  library,
  onPatch,
  onAssignRelease,
  onCreateRelease,
  onToggleList,
  onCreateList,
}: {
  song: Song;
  library: Library;
  onPatch: (patch: Partial<Song>) => void;
  onAssignRelease: (releaseId: string | null) => void;
  onCreateRelease: () => void;
  onToggleList: (listId: string) => void;
  onCreateList: (name: string) => void;
}) {
  const releaseOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: "Sin álbum" },
      ...library.releases.map((r) => ({
        value: r.id,
        label: `${KIND_LABEL[r.kind]} · ${r.name || "Sin nombre"}`,
      })),
      { value: "__new__", label: "＋ Nuevo álbum…" },
    ],
    [library.releases],
  );

  const assignedLists = library.lists.filter((l) =>
    song.listIds.includes(l.id),
  );

  const listOptions: SelectOption[] = useMemo(
    () =>
      library.lists
        .filter((l) => !song.listIds.includes(l.id))
        .map((l) => ({ value: l.id, label: l.name || "Sin nombre" })),
    [library.lists, song.listIds],
  );

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-2 md:px-8">
      {/* Estado */}
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${STATE_DOT[song.estado]}`}
          aria-hidden
        />
        <div className="w-28">
          <SearchableSelect
            value={song.estado}
            onChange={(v) => onPatch({ estado: v as SongState })}
            options={STATE_OPTIONS}
            ariaLabel="Estado de la canción"
            searchPlaceholder="Buscar…"
            emptyText="—"
            className={COMPACT_SELECT}
          />
        </div>
      </div>

      {/* Género */}
      <div className="w-32">
        <SearchableSelect
          value={song.genre}
          onChange={(v) => onPatch({ genre: v as Genre | "" })}
          options={GENRE_OPTIONS}
          placeholder="Género…"
          ariaLabel="Género"
          searchPlaceholder="Buscar…"
          emptyText="Sin resultados"
          className={COMPACT_SELECT}
        />
      </div>

      {/* Álbum / release (exclusivo) */}
      <div className="w-44">
        <SearchableSelect
          value={song.releaseId ?? ""}
          onChange={(v) => {
            if (v === "__new__") onCreateRelease();
            else onAssignRelease(v || null);
          }}
          options={releaseOptions}
          placeholder="Álbum…"
          ariaLabel="Álbum o release"
          searchPlaceholder="Buscar release…"
          emptyText="Sin releases"
          className={COMPACT_SELECT}
        />
      </div>

      {/* Listas (many-to-many) */}
      <div className="flex flex-wrap items-center gap-1">
        {assignedLists.map((l) => (
          <span
            key={l.id}
            className="inline-flex items-center gap-1 rounded-full border border-amethyst-400/40 bg-amethyst-500/10 px-2 py-0.5 text-[0.7rem] text-amethyst-200"
          >
            {l.name || "Sin nombre"}
            <button
              type="button"
              onClick={() => onToggleList(l.id)}
              className="text-amethyst-300/70 transition hover:text-danger"
              aria-label={`Quitar de ${l.name}`}
            >
              ✕
            </button>
          </span>
        ))}
        <div className="w-32">
          <SearchableSelect
            value=""
            onChange={(v) => {
              const existing = library.lists.find((l) => l.id === v);
              if (existing) onToggleList(existing.id);
              else if (v.trim()) onCreateList(v.trim());
            }}
            options={listOptions}
            placeholder="＋ Lista…"
            ariaLabel="Añadir a lista"
            searchPlaceholder="Buscar o crear…"
            emptyText="Escribe para crear"
            allowCustom
            customLabel={(t) => `Crear lista "${t}"`}
            className={COMPACT_SELECT}
          />
        </div>
      </div>
    </div>
  );
}
