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
const isAccented = (c: string): boolean => "áéíóú".includes(c);

/** Un núcleo silábico (una sílaba), con si lleva la vocal acentuada. */
export interface Nucleus {
  accented: boolean;
}

/**
 * Núcleos silábicos de una palabra, en orden. Fusiona diptongos/triptongos y
 * separa hiatos (misma regla que el conteo). Base compartida para contar
 * sílabas y para localizar la tónica (métrica en [[metrics]]).
 */
export function syllableNuclei(word: string): Nucleus[] {
  const w = word.toLowerCase();
  const out: Nucleus[] = [];
  let i = 0;
  while (i < w.length) {
    if (!isVowel(w[i])) {
      i++;
      continue;
    }
    let accented = isAccented(w[i]);
    let j = i + 1;
    while (j < w.length && isVowel(w[j])) {
      const prev = w[j - 1];
      const cur = w[j];
      const hiatus =
        (isStrong(prev) && isStrong(cur)) ||
        isAccentedWeak(prev) ||
        isAccentedWeak(cur);
      if (hiatus) break;
      if (isAccented(cur)) accented = true;
      j++;
    }
    out.push({ accented });
    i = j;
  }
  return out;
}

/** Sílabas de una palabra suelta. */
export function wordSyllables(word: string): number {
  return syllableNuclei(word).length;
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
