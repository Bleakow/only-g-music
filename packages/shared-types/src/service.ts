/**
 * Entidad de dominio: Servicio del catálogo de contratación. Tipos puros y
 * portables. No importar UI ni Firebase aquí.
 */

export type PricingModel =
  | "por_hora"
  | "por_cancion"
  | "por_proyecto"
  | "a_cotizar";

/** Variante/opción de un servicio (p. ej. Renta: por horas / día / varios días). */
export interface ServiceVariant {
  id: string;
  name: string;
  description?: string;
  pricing: PricingModel;
  basePrice?: number;
}

export interface Service {
  slug: string;
  name: string;
  description: string;
  pricing: PricingModel;
  /** Precio base en COP. Ausente cuando `pricing === "a_cotizar"`. */
  basePrice?: number;
  /** Imagen pequeña para la card (estilo menú). */
  image?: string;
  /** Opciones del servicio; si existen, se elige una variante (no el servicio). */
  variants?: ServiceVariant[];
}

/** Algo con precio: un servicio o una de sus variantes. */
type Priceable = { pricing: PricingModel; basePrice?: number };

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function hasVariants(s: Service): boolean {
  return !!s.variants && s.variants.length > 0;
}

/**
 * Los precios conocidos se **agendan directo**; los de alcance variable se
 * **cotizan** primero. Bifurcador del embudo de contratación.
 */
export function isQuoteOnly(p: Priceable): boolean {
  return p.pricing === "a_cotizar" || p.basePrice == null;
}

/** Etiqueta de precio para la UI ("Desde $X / hora" o "A cotizar"). */
export function priceLabel(p: Priceable): string {
  if (isQuoteOnly(p)) return "A cotizar";
  const price = COP.format(p.basePrice!);
  const suffix =
    p.pricing === "por_hora"
      ? " / hora"
      : p.pricing === "por_cancion"
        ? " / canción"
        : "";
  return `Desde ${price}${suffix}`;
}

/** Formatea un valor COP (para totales del pedido). */
export function formatCOP(value: number): string {
  return COP.format(value);
}

/** Unidad de la cantidad según el modelo de precio. */
export function unitLabel(p: Priceable): string {
  switch (p.pricing) {
    case "por_hora":
      return "horas";
    case "por_cancion":
      return "canciones";
    default:
      return "unidades";
  }
}
