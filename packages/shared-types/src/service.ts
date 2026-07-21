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
  /**
   * ¿Tiene sentido elegir una CANTIDAD (stepper +/-) de esta variante? Ausente =
   * true. `false` = se elige/deselecciona (una sola), sin contador — p. ej. los
   * tramos "1 artista"/"2 artistas" de producción (el contador solo aplica a
   * "agrupación", que cuenta personas). */
  countable?: boolean;
}

export interface Service {
  slug: string;
  name: string;
  description: string;
  pricing: PricingModel;
  /** Precio base en COP (por DEFECTO; una sede puede sobreescribirlo). Ausente
   *  cuando `pricing === "a_cotizar"`. */
  basePrice?: number;
  /** Imagen pequeña para la card (estilo menú). GLOBAL: no cambia por sede. */
  image?: string;
  /** Opciones del servicio; si existen, se elige una variante (no el servicio). */
  variants?: ServiceVariant[];
  /** Las variantes son EXCLUYENTES: se elige UNA sola (p. ej. producción: 1 / 2 /
   *  agrupación). Elegir otra reemplaza la anterior. Ausente = se pueden combinar. */
  singleChoice?: boolean;
  /** Activo globalmente. Ausente = true. Un `false` lo oculta en TODAS las sedes. */
  active?: boolean;
  /** Orden en el catálogo (menor primero). Ausente = 0. */
  order?: number;
}

/**
 * Override de un servicio PARA UNA SEDE. Nombre y foto son GLOBALES (no se tocan
 * aquí); una sede solo puede desactivar el servicio o cambiar su precio (y el de
 * sus variantes). Ausente = hereda los valores globales.
 */
export interface SedeServiceOverride {
  /** El estudio no ofrece este servicio. */
  disabled?: boolean;
  /** Precio base para ESTE estudio (gana sobre el global). */
  basePrice?: number;
  /** Override por variante (desactivar / reprecio). */
  variants?: Record<string, { disabled?: boolean; basePrice?: number }>;
}

/** Overrides de una sede, indexados por `slug` de servicio. */
export type SedeOverrides = Record<string, SedeServiceOverride>;

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

// ── Resolución por sede (estudio-primero) ───────────────────────────
// Nombre y foto son GLOBALES; una sede solo desactiva o repreciona.

/** ¿El servicio está disponible en la sede? (activo global y no desactivado allí). */
export function serviceEnabledInSede(
  s: Service,
  ov?: SedeServiceOverride,
): boolean {
  return (s.active ?? true) && !ov?.disabled;
}

/**
 * Resuelve un servicio PARA UNA SEDE: aplica el precio override (servicio y
 * variantes) y quita las variantes desactivadas. Devuelve `null` si el servicio
 * no está disponible en esa sede (desactivado, o con variantes pero ninguna
 * habilitada). Nombre/foto quedan intactos (son globales).
 */
export function resolveServiceForSede(
  s: Service,
  ov?: SedeServiceOverride,
): Service | null {
  if (!serviceEnabledInSede(s, ov)) return null;
  const hadVariants = !!s.variants && s.variants.length > 0;
  const variants = s.variants
    ?.map((v) => {
      const vov = ov?.variants?.[v.id];
      if (vov?.disabled) return null;
      return vov?.basePrice != null ? { ...v, basePrice: vov.basePrice } : v;
    })
    .filter((v): v is ServiceVariant => v !== null);
  // Servicio con variantes pero todas desactivadas en la sede → no ofrecible.
  if (hadVariants && (variants?.length ?? 0) === 0) return null;
  return {
    ...s,
    basePrice: ov?.basePrice != null ? ov.basePrice : s.basePrice,
    ...(variants ? { variants } : {}),
  };
}

/** Catálogo efectivo de una sede: servicios disponibles con precios efectivos,
 *  ordenados por `order`. Los consumidores (comprar/cotizar/servicios) trabajan
 *  sobre ESTO, no sobre el catálogo global crudo. */
export function resolveCatalogForSede(
  services: Service[],
  overrides?: SedeOverrides,
): Service[] {
  return services
    .map((s) => resolveServiceForSede(s, overrides?.[s.slug]))
    .filter((s): s is Service => s !== null)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
