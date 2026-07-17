// Modelo local de la biblioteca de composición (M2, persistencia en localStorage).
// En M6 esto se sincroniza a Firestore bajo la cuenta del usuario.

// Catálogo amplio con foco en Colombia: urbano/latino global + folclor y música
// popular colombiana (vallenato, champeta, currulao, música popular…) + globales.
export const GENRES = [
  // Urbano / latino global
  "Reggaetón",
  "Trap",
  "Rap",
  "Urbano",
  "Afrobeat",
  "Dembow",
  "R&B",
  "Dancehall",
  "Reggae",
  // Colombia — costa, folclor y popular
  "Vallenato",
  "Cumbia",
  "Champeta",
  "Currulao",
  "Salsa",
  "Salsa choke",
  "Porro",
  "Merengue",
  "Bachata",
  "Bolero",
  "Música popular",
  "Ranchera",
  "Corridos tumbados",
  "Guaracha",
  "Bambuco",
  "Pasillo",
  "Joropo",
  "Mapalé",
  // Globales
  "Pop",
  "Balada",
  "Rock",
  "Metal",
  "Punk",
  "Indie",
  "Electrónica",
  "House",
  "Gospel",
  "Jazz",
  "Funk",
  "Regional",
  "Otros",
] as const;

export type Genre = (typeof GENRES)[number];

// ── Estado de la canción (workflow simple: en progreso vs lista) ───────────
// Dos estados a propósito: menos fricción, decisión binaria "¿está lista o no?".
export const SONG_STATES = ["borrador", "terminada"] as const;

export type SongState = (typeof SONG_STATES)[number];

export const STATE_LABEL: Record<SongState, string> = {
  borrador: "Borrador",
  terminada: "Terminada",
};

// Punto de color por estado (tokens de estado semántico de globals.css).
export const STATE_DOT: Record<SongState, string> = {
  borrador: "bg-warning",
  terminada: "bg-success",
};

// ── Release: contenedor EXCLUSIVO (álbum/EP/LP/single/mixtape) ─────────────
// No son géneros: son formatos de lanzamiento por duración. Una canción
// pertenece a ≤1 release y ocupa una posición en su tracklist (trackNo).
export const RELEASE_KINDS = ["album", "ep", "lp", "single", "mixtape"] as const;

export type ReleaseKind = (typeof RELEASE_KINDS)[number];

export const KIND_LABEL: Record<ReleaseKind, string> = {
  album: "Álbum",
  ep: "EP",
  lp: "LP",
  single: "Single",
  mixtape: "Mixtape",
};

export interface Release {
  id: string;
  name: string;
  kind: ReleaseKind;
  year: number | null;
  createdAt: number;
}

// ── Lista/setlist: agrupación libre y SOLAPABLE (1 canción → N listas) ─────
export interface SongList {
  id: string;
  name: string;
  createdAt: number;
}

export interface Song {
  id: string;
  title: string;
  genre: Genre | "";
  estado: SongState;
  /** Release al que pertenece (exclusivo). null = suelta. */
  releaseId: string | null;
  /** Posición en el tracklist del release (1-based). null si no tiene release. */
  trackNo: number | null;
  /** Listas a las que pertenece (many-to-many). */
  listIds: string[];
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface Library {
  songs: Song[];
  releases: Release[];
  lists: SongList[];
  activeId: string | null;
}
