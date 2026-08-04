/**
 * Marca de una tarjeta a partir de su número (lógica PURA).
 *
 * Se detecta con los primeros dígitos (el IIN/BIN, que identifica al emisor), así
 * que funciona desde el cuarto carácter — antes de que el usuario termine de
 * escribir. Es lo que permite enseñarle su logo mientras teclea o justo al pegar.
 *
 * NO valida que la tarjeta exista ni que tenga fondos: de eso se encarga la
 * pasarela. Esto es solo reconocimiento visual.
 */

export type MarcaTarjeta = "visa" | "mastercard" | "amex" | "diners" | null;

/** Cuántos dígitos tiene el número según la marca (para el `maxLength`). */
export const LARGO_POR_MARCA: Record<Exclude<MarcaTarjeta, null>, number> = {
  visa: 16,
  mastercard: 16,
  amex: 15,
  diners: 14,
};

/**
 * Reconoce la marca. Reglas del estándar ISO/IEC 7812:
 *  - Visa: empieza por 4.
 *  - Mastercard: 51-55, o el rango nuevo 2221-2720.
 *  - Amex: 34 o 37.
 *  - Diners: 300-305, 36 o 38.
 */
export function marcaDeTarjeta(numero: string): MarcaTarjeta {
  const d = numero.replace(/\D/g, "");
  if (d.length < 2) {
    // Con un solo dígito solo Visa es inequívoca (nadie más empieza por 4).
    return d === "4" ? "visa" : null;
  }
  if (d.startsWith("4")) return "visa";

  const dos = Number(d.slice(0, 2));
  if (dos >= 51 && dos <= 55) return "mastercard";
  if (dos === 34 || dos === 37) return "amex";
  if (dos === 36 || dos === 38) return "diners";

  if (d.length >= 3) {
    const tres = Number(d.slice(0, 3));
    if (tres >= 300 && tres <= 305) return "diners";
  }
  if (d.length >= 4) {
    const cuatro = Number(d.slice(0, 4));
    if (cuatro >= 2221 && cuatro <= 2720) return "mastercard";
  }
  return null;
}

/**
 * Agrupa el número para que se lea: de cuatro en cuatro, salvo Amex, que se
 * imprime 4-6-5 en la propia tarjeta. Copiar el formato impreso evita que el
 * usuario dude de si se equivocó al teclear.
 */
export function formatearNumero(numero: string): string {
  const marca = marcaDeTarjeta(numero);
  const largo = marca ? LARGO_POR_MARCA[marca] : 19;
  const d = numero.replace(/\D/g, "").slice(0, largo);
  const grupos = marca === "amex" ? [4, 6, 5] : [4, 4, 4, 4, 4];

  const partes: string[] = [];
  let i = 0;
  for (const g of grupos) {
    if (i >= d.length) break;
    partes.push(d.slice(i, i + g));
    i += g;
  }
  return partes.join(" ");
}
