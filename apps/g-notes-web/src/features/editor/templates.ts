// Plantillas de estructura de canción. Cada plantilla es una lista ordenada de
// secciones que se insertan como marcadores `[Sección]`. Se basan en estructuras
// reales de composición: los géneros cuya forma cambia de verdad (salsa, vallenato,
// corrido, reggaetón, rap…) tienen plantilla propia; el resto usa las generales.

import type { Genre } from "@/features/library/types";

export interface SongTemplate {
  id: string;
  name: string;
  description: string;
  /** Secciones en orden. Se vuelcan como líneas `[Sección]` con hueco para escribir. */
  sections: string[];
}

export const SONG_TEMPLATES: SongTemplate[] = [
  {
    id: "pop",
    name: "Pop / General",
    description:
      "La estructura más común: versos con pre-coro y coro, y un puente antes del coro final.",
    sections: [
      "Intro",
      "Verso",
      "Pre-coro",
      "Coro",
      "Verso",
      "Pre-coro",
      "Coro",
      "Puente",
      "Coro",
      "Outro",
    ],
  },
  {
    id: "reggaeton",
    name: "Reggaetón",
    description:
      "Arranca con el hook: el coro engancha desde el segundo cero y se repite mucho.",
    sections: [
      "Intro",
      "Coro",
      "Verso",
      "Coro",
      "Verso",
      "Pre-coro",
      "Coro",
      "Puente",
      "Coro",
    ],
  },
  {
    id: "trap",
    name: "Trap",
    description: "Directo y hook-heavy: coro, verso, coro. Sin adornos.",
    sections: ["Intro", "Coro", "Verso", "Coro", "Verso", "Coro", "Outro"],
  },
  {
    id: "salsa",
    name: "Salsa (son / montuno)",
    description:
      "Cuerpo cantado → coro → montuno (pregón y coro que responden) → mambo → moña.",
    sections: [
      "Intro",
      "Verso",
      "Verso",
      "Coro",
      "Montuno (pregón)",
      "Mambo",
      "Moña",
      "Coro",
      "Final",
    ],
  },
  {
    id: "vallenato",
    name: "Vallenato",
    description:
      "Con la dedicatoria hablada al inicio y la despedida al cierre, como manda la tradición.",
    sections: [
      "Intro",
      "Dedicatoria",
      "Verso",
      "Coro",
      "Verso",
      "Coro",
      "Puente",
      "Coro",
      "Despedida",
    ],
  },
  {
    id: "corrido",
    name: "Corrido / Corridos tumbados",
    description:
      "Narrativo: cuenta una historia en versos encadenados y cierra con la despedida.",
    sections: ["Intro", "Verso", "Verso", "Coro", "Verso", "Verso", "Despedida"],
  },
  {
    id: "cumbia",
    name: "Cumbia",
    description: "Versos y coros con un respiro instrumental que invita al baile.",
    sections: ["Intro", "Verso", "Coro", "Verso", "Coro", "Instrumental", "Coro", "Outro"],
  },
  {
    id: "balada",
    name: "Balada",
    description: "Crece despacio: verso, pre-coro, coro y un puente emotivo antes del cierre.",
    sections: [
      "Intro",
      "Verso",
      "Pre-coro",
      "Coro",
      "Verso",
      "Pre-coro",
      "Coro",
      "Puente",
      "Coro",
    ],
  },
  {
    id: "rap",
    name: "Rap / Hip-hop",
    description: "Versos largos (16 barras) alternando con el estribillo.",
    sections: ["Intro", "Verso", "Estribillo", "Verso", "Estribillo", "Verso", "Outro"],
  },
  {
    id: "simple",
    name: "Simple (verso-coro)",
    description: "Lo esencial para bocetar una idea rápido.",
    sections: ["Verso", "Coro", "Verso", "Coro", "Puente", "Coro"],
  },
];

// Género → plantilla sugerida. Lo que no esté aquí cae en la general "pop".
const GENRE_TEMPLATE: Partial<Record<Genre, string>> = {
  Reggaetón: "reggaeton",
  Trap: "trap",
  Salsa: "salsa",
  "Salsa choke": "salsa",
  Vallenato: "vallenato",
  "Corridos tumbados": "corrido",
  Cumbia: "cumbia",
  Porro: "cumbia",
  Balada: "balada",
  Bolero: "balada",
  Bachata: "balada",
  Rap: "rap",
};

export function suggestedTemplateId(genre?: string): string {
  if (genre && genre in GENRE_TEMPLATE) {
    return GENRE_TEMPLATE[genre as Genre] ?? "pop";
  }
  return "pop";
}

export function getTemplate(id: string): SongTemplate | undefined {
  return SONG_TEMPLATES.find((t) => t.id === id);
}
