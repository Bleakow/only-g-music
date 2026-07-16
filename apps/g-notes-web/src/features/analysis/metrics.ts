// Análisis métrico del verso (español, determinista — sin IA).
// Sobre el conteo de sílabas gramaticales aplica las dos reglas de la métrica:
//   1. Sinalefa: si una palabra acaba en vocal y la siguiente empieza por vocal
//      (o h muda), sus sílabas se funden → −1 por cada frontera.
//   2. Acento final del verso: aguda +1, esdrújula −1, llana 0.

import { syllableNuclei, wordSyllables } from "@/features/notebook/syllables";
import { isSectionLine } from "@/features/editor/sections";

const WORD_RE = /[a-záéíóúüñ]+/gi;

export type Stress = "aguda" | "llana" | "esdrujula";

/** Clasifica la acentuación de una palabra (para la regla del acento final). */
export function stressType(word: string): Stress {
  const nuclei = syllableNuclei(word);
  const n = nuclei.length;
  if (n <= 1) return "aguda"; // monosílabos: efecto agudo (+1)

  const accentedIdx = nuclei.findIndex((x) => x.accented); // 0-based desde inicio
  let fromEnd: number;
  if (accentedIdx >= 0) {
    fromEnd = n - accentedIdx; // 1 = última sílaba
  } else {
    // Sin tilde: llana si termina en vocal, n o s; aguda en el resto.
    const last = word.toLowerCase().slice(-1);
    fromEnd = /[aeiouns]/.test(last) ? 2 : 1;
  }
  if (fromEnd === 1) return "aguda";
  if (fromEnd === 2) return "llana";
  return "esdrujula";
}

/** Sílabas MÉTRICAS de un verso (con sinalefa y regla del acento final). */
export function metricSyllables(verse: string): number {
  const words = verse.match(WORD_RE);
  if (!words || words.length === 0) return 0;

  let count = words.reduce((total, w) => total + wordSyllables(w), 0);

  // Sinalefa entre palabras contiguas.
  for (let i = 1; i < words.length; i++) {
    const prevEndsVowel = /[aeiouáéíóúü]$/i.test(words[i - 1]);
    const curStartsVowel = /^[haeiouáéíóúü]/i.test(words[i]); // h muda
    if (prevEndsVowel && curStartsVowel) count -= 1;
  }

  // Regla del acento final.
  const stress = stressType(words[words.length - 1]);
  if (stress === "aguda") count += 1;
  else if (stress === "esdrujula") count -= 1;

  return Math.max(count, 0);
}

const NAMES: Record<number, string> = {
  2: "bisílabo",
  3: "trisílabo",
  4: "tetrasílabo",
  5: "pentasílabo",
  6: "hexasílabo",
  7: "heptasílabo",
  8: "octosílabo",
  9: "eneasílabo",
  10: "decasílabo",
  11: "endecasílabo",
  12: "dodecasílabo",
  13: "tridecasílabo",
  14: "alejandrino",
};

export function metricName(n: number): string {
  return NAMES[n] ?? `${n} sílabas`;
}

export interface SongAnalysis {
  dominant: number; // métrica más frecuente (0 si no hay versos)
  consistencyPct: number; // % de versos que igualan la dominante
  name: string; // nombre de la forma dominante
  verseCount: number;
}

/** Analiza el cuerpo de una canción (ignora líneas de sección y vacías). */
export function analyzeSong(body: string): SongAnalysis {
  const verses = body
    .split("\n")
    .filter((l) => l.trim() && !isSectionLine(l))
    .map(metricSyllables)
    .filter((m) => m > 0);

  if (verses.length === 0) {
    return { dominant: 0, consistencyPct: 0, name: "", verseCount: 0 };
  }

  const freq = new Map<number, number>();
  for (const m of verses) freq.set(m, (freq.get(m) ?? 0) + 1);

  let dominant = verses[0];
  let best = 0;
  for (const [m, c] of freq) {
    if (c > best) {
      best = c;
      dominant = m;
    }
  }

  return {
    dominant,
    consistencyPct: Math.round((best / verses.length) * 100),
    name: metricName(dominant),
    verseCount: verses.length,
  };
}
