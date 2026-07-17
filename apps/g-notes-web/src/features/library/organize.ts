import {
  KIND_LABEL,
  SONG_STATES,
  STATE_LABEL,
  type Library,
  type Song,
} from "@/features/library/types";

// Dimensiones por las que se puede organizar la biblioteca en el sidebar.
export type GroupBy = "none" | "estado" | "genero" | "release" | "lista";

export const GROUP_LABEL: Record<GroupBy, string> = {
  none: "Todas",
  estado: "Estado",
  genero: "Género",
  release: "Álbum",
  lista: "Lista",
};

export interface LibrarySection {
  key: string;
  label: string;
  songs: Song[];
  /** Cajón de "sin clasificar" (se pinta apagado). */
  loose?: boolean;
}

/**
 * Agrupa las canciones según la dimensión elegida. Reglas por tipo:
 * - estado/género: buckets derivados → se ocultan los vacíos.
 * - release/lista: entidades del usuario → se muestran aunque estén vacías.
 * - lista es many-to-many → una canción puede salir en varias secciones.
 */
export function organize(lib: Library, groupBy: GroupBy): LibrarySection[] {
  const { songs } = lib;

  if (groupBy === "none") {
    return [{ key: "all", label: "Todas", songs }];
  }

  if (groupBy === "estado") {
    return SONG_STATES.map((st) => ({
      key: st,
      label: STATE_LABEL[st],
      songs: songs.filter((s) => s.estado === st),
    })).filter((sec) => sec.songs.length > 0);
  }

  if (groupBy === "genero") {
    const keys = Array.from(new Set(songs.map((s) => s.genre || "")));
    return keys
      .map((g) => ({
        key: g || "__nogenre__",
        label: g || "Sin género",
        songs: songs.filter((s) => (s.genre || "") === g),
        loose: !g,
      }))
      .sort((a, b) => {
        if (a.loose) return 1;
        if (b.loose) return -1;
        return a.label.localeCompare(b.label);
      });
  }

  if (groupBy === "release") {
    const sections: LibrarySection[] = lib.releases
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({
        key: r.id,
        label: `${KIND_LABEL[r.kind]} · ${r.name || "Sin nombre"}`,
        songs: songs
          .filter((s) => s.releaseId === r.id)
          .sort((a, b) => (a.trackNo ?? 0) - (b.trackNo ?? 0)),
      }));
    const loose = songs.filter((s) => !s.releaseId);
    if (loose.length) {
      sections.push({ key: "__loose__", label: "Sueltas", songs: loose, loose: true });
    }
    return sections;
  }

  // lista (many-to-many)
  const sections: LibrarySection[] = lib.lists
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((l) => ({
      key: l.id,
      label: l.name || "Sin nombre",
      songs: songs.filter((s) => s.listIds.includes(l.id)),
    }));
  const noList = songs.filter((s) => s.listIds.length === 0);
  if (noList.length) {
    sections.push({ key: "__nolist__", label: "Sin lista", songs: noList, loose: true });
  }
  return sections;
}
