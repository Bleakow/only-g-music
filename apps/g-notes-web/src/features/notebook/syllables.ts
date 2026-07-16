// Heurístico de conteo de sílabas para español (M1, aproximado).
//
// Reglas aplicadas: se cuenta un núcleo silábico por vocal, fusionando
// diptongos/triptongos (vocal fuerte + débil átona, o débil + débil) y
// separando hiatos (fuerte + fuerte, o cualquier débil acentuada).
//
// Limitaciones conocidas (se refinan en M3, "herramientas deterministas"):
//   - No aplica sinalefa entre palabras (la unión vocálica en la métrica del
//     verso). El conteo por verso es la SUMA de palabras, sin fusionar fronteras.
//   - No aplica la regla del acento final del verso (aguda +1, esdrújula −1).
// Aun así da una estimación útil mientras escribes.

const isVowel = (c: string): boolean => "aeiouáéíóúü".includes(c);
const isStrong = (c: string): boolean => "aeoáéó".includes(c);
const isAccentedWeak = (c: string): boolean => "íú".includes(c);

/** Sílabas de una palabra suelta. */
export function wordSyllables(word: string): number {
  const w = word.toLowerCase();
  let syllables = 0;
  let i = 0;
  while (i < w.length) {
    if (!isVowel(w[i])) {
      i++;
      continue;
    }
    syllables++;
    // Consumir el grupo vocálico, cortando en hiato.
    let j = i + 1;
    while (j < w.length && isVowel(w[j])) {
      const prev = w[j - 1];
      const cur = w[j];
      const hiatus =
        (isStrong(prev) && isStrong(cur)) ||
        isAccentedWeak(prev) ||
        isAccentedWeak(cur);
      if (hiatus) break;
      j++;
    }
    i = j;
  }
  return syllables;
}

/** Sílabas de una línea/verso: suma por palabra (sin sinalefa, ver nota). */
export function lineSyllables(line: string): number {
  const words = line.match(/[a-záéíóúüñ]+/gi);
  if (!words) return 0;
  return words.reduce((total, w) => total + wordSyllables(w), 0);
}

export function countWords(text: string): number {
  const m = text.match(/[a-záéíóúüñ0-9]+/gi);
  return m ? m.length : 0;
}

/** Número de líneas no vacías (versos con contenido). */
export function countLines(text: string): number {
  return text.split("\n").filter((l) => l.trim().length > 0).length;
}
