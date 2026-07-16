import type { Library, Song } from "@/features/library/types";

const KEY = "g-notes:library:v1";

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newSong(partial?: Partial<Song>): Song {
  const now = Date.now();
  return {
    id: uid(),
    title: "",
    genre: "",
    body: "",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/** Carga la biblioteca; si no hay nada, arranca con una canción en blanco. */
export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const lib = JSON.parse(raw) as Library;
      if (lib.songs?.length) {
        return {
          songs: lib.songs,
          activeId: lib.activeId ?? lib.songs[0].id,
        };
      }
    }
  } catch {
    /* localStorage no disponible o corrupto */
  }
  const first = newSong();
  return { songs: [first], activeId: first.id };
}

export function persistLibrary(lib: Library): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lib));
  } catch {
    /* cuota llena o modo privado: se ignora en M2 */
  }
}
