"use client";

import { useMemo } from "react";
import { SearchableSelect, type SelectOption } from "@only-g/ui";
import { CHIP_SELECT } from "@/components/ui";
import {
  SONG_TEMPLATES,
  suggestedTemplateId,
} from "@/features/editor/templates";
import {
  GENRES,
  KIND_LABEL,
  STATE_DOT,
  STATE_LABEL,
  type Genre,
  type Library,
  type Song,
  type SongState,
} from "@/features/library/types";

const GENRE_OPTIONS: SelectOption[] = [
  { value: "", label: "Sin género" },
  ...GENRES.map((g) => ({ value: g, label: g })),
];

/**
 * Tira de metadatos como CHIPS ligeros: estado · género · álbum · ＋plantilla.
 * Nivel 4 de la jerarquía — presente pero apagado, sin peso de formulario. Las
 * listas y lo secundario viven en el menú «···» (OverflowMenu). Responsive:
 * los chips fluyen (flex-wrap) en pantallas estrechas.
 */
export function SongMeta({
  song,
  library,
  onPatch,
  onAssignRelease,
  onCreateRelease,
  onApplyTemplate,
}: {
  song: Song;
  library: Library;
  onPatch: (patch: Partial<Song>) => void;
  onAssignRelease: (releaseId: string | null) => void;
  onCreateRelease: () => void;
  onApplyTemplate: (templateId: string) => void;
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

  const templateOptions: SelectOption[] = useMemo(() => {
    const suggested = suggestedTemplateId(song.genre || undefined);
    return [...SONG_TEMPLATES]
      .sort((a, b) => (a.id === suggested ? -1 : b.id === suggested ? 1 : 0))
      .map((t) => ({
        value: t.id,
        label: t.id === suggested ? `${t.name} · sugerida` : t.name,
      }));
  }, [song.genre]);

  // Estado: solo 2 (borrador/terminada), así que un chip que ALTERNA al pulsar.
  const nextState: SongState =
    song.estado === "borrador" ? "terminada" : "borrador";
  const done = song.estado === "terminada";

  return (
    <>
      {/* Estado — chip toggle con color semántico */}
      <button
        type="button"
        onClick={() => onPatch({ estado: nextState })}
        title={`Marcar como ${STATE_LABEL[nextState]}`}
        className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
          done
            ? "border-success/30 text-success hover:border-success/50"
            : "border-warning/30 text-warning hover:border-warning/50"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[song.estado]}`}
          aria-hidden
        />
        {STATE_LABEL[song.estado]}
      </button>

      {/* Género */}
      <div className="w-32">
        <SearchableSelect
          value={song.genre}
          onChange={(v) => onPatch({ genre: v as Genre | "" })}
          options={GENRE_OPTIONS}
          placeholder="Género"
          ariaLabel="Género"
          searchPlaceholder="Buscar…"
          emptyText="Sin resultados"
          className={CHIP_SELECT}
        />
      </div>

      {/* Álbum / release (exclusivo) */}
      <div className="w-40">
        <SearchableSelect
          value={song.releaseId ?? ""}
          onChange={(v) => {
            if (v === "__new__") onCreateRelease();
            else onAssignRelease(v || null);
          }}
          options={releaseOptions}
          placeholder="Álbum"
          ariaLabel="Álbum o release"
          searchPlaceholder="Buscar release…"
          emptyText="Sin releases"
          className={CHIP_SELECT}
        />
      </div>

      {/* ＋ Plantilla (acción: inserta una estructura) */}
      <div className="w-36">
        <SearchableSelect
          value=""
          onChange={(id) => onApplyTemplate(id)}
          options={templateOptions}
          placeholder="＋ Plantilla"
          ariaLabel="Insertar plantilla de estructura"
          searchPlaceholder="Buscar plantilla…"
          emptyText="Sin plantillas"
          className={CHIP_SELECT}
        />
      </div>
    </>
  );
}
