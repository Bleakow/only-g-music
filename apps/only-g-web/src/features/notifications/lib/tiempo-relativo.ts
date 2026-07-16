/**
 * Tiempo relativo local-aware ("hace 2 h", "ayer", "hace 3 d") vía
 * `Intl.RelativeTimeFormat`. Puro salvo el `ahora` (que el llamador puede
 * inyectar para tests / estabilidad). Sin librerías de fechas.
 */
const DIVISIONES: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export function tiempoRelativo(
  epochMs: number,
  locale: string,
  ahora: number = Date.now(),
): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let duracion = (epochMs - ahora) / 1000; // segundos; negativo = pasado
  for (const div of DIVISIONES) {
    if (Math.abs(duracion) < div.amount) {
      return rtf.format(Math.round(duracion), div.unit);
    }
    duracion /= div.amount;
  }
  return "";
}
