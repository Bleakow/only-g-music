// Modelo local de la biblioteca de composición (M2, persistencia en localStorage).
// En M6 esto se sincroniza a Firestore bajo la cuenta del usuario.

export const GENRES = [
  "Reggaetón",
  "Trap",
  "Rap",
  "Pop",
  "Salsa",
  "Rock",
  "Balada",
  "Afrobeat",
  "Urbano",
  "Electrónica",
  "Gospel",
  "Regional",
  "Otros",
] as const;

export type Genre = (typeof GENRES)[number];

export interface Song {
  id: string;
  title: string;
  genre: Genre | "";
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface Library {
  songs: Song[];
  activeId: string | null;
}
