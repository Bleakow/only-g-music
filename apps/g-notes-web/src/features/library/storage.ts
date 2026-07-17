import {
  type Library,
  type Release,
  type ReleaseKind,
  type Song,
  type SongList,
  type SongState,
} from "@/features/library/types";

const KEY = "g-notes:library:v1";

function uid(prefix?: string): string {
  const core =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return prefix ? `${prefix}_${core}` : core;
}

export function newSong(partial?: Partial<Song>): Song {
  const now = Date.now();
  return {
    id: uid(),
    title: "",
    genre: "",
    estado: "borrador",
    releaseId: null,
    trackNo: null,
    listIds: [],
    body: "",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function newRelease(name: string, kind: ReleaseKind = "album"): Release {
  return {
    id: uid("rel"),
    name: name.trim(),
    kind,
    year: null,
    createdAt: Date.now(),
  };
}

export function newList(name: string): SongList {
  return { id: uid("lst"), name: name.trim(), createdAt: Date.now() };
}

// Estados viejos (idea/demo/registrada) → el nuevo modelo de dos estados.
function normalizeState(v: unknown): SongState {
  return v === "terminada" || v === "registrada" ? "terminada" : "borrador";
}

// Backfill: normaliza una canción de un esquema anterior (antes de estado/release/
// listas) para que la biblioteca vieja siga cargando sin perder datos.
function migrateSong(raw: Partial<Song>): Song {
  return {
    id: raw.id ?? uid(),
    title: raw.title ?? "",
    genre: raw.genre ?? "",
    estado: normalizeState(raw.estado),
    releaseId: raw.releaseId ?? null,
    trackNo: raw.trackNo ?? null,
    listIds: raw.listIds ?? [],
    body: raw.body ?? "",
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? Date.now(),
  };
}

/** Carga la biblioteca; si no hay nada, arranca con una canción en blanco. */
export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const lib = JSON.parse(raw) as Partial<Library>;
      if (lib.songs?.length) {
        const songs = lib.songs.map(migrateSong);
        return {
          songs,
          releases: lib.releases ?? [],
          lists: lib.lists ?? [],
          activeId: lib.activeId ?? songs[0].id,
        };
      }
    }
  } catch {
    /* localStorage no disponible o corrupto */
  }
  const first = newSong();
  return { songs: [first], releases: [], lists: [], activeId: first.id };
}

export function persistLibrary(lib: Library): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lib));
  } catch {
    /* cuota llena o modo privado: se ignora en M2 */
  }
}
