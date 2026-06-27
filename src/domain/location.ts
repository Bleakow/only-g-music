/**
 * Ubicación estructurada (país → departamento/estado → ciudad). PURA: sin UI ni
 * datos pesados aquí (los datasets viven en features/location/data y se cargan
 * perezosos). Guardar estructurado permite filtrar/agrupar a futuro por ciudad o
 * departamento; el texto plano se deriva con `formatLocation`.
 */
export type CountryCode = "CO" | "US";

/** Países soportados por ahora (extensible: añadir el code + su dataset). */
export const COUNTRY_CODES: CountryCode[] = ["CO", "US"];

export interface GeoLocation {
  country: CountryCode;
  /** Nombre del departamento (CO) o estado (US). */
  state: string;
  city: string;
}

/** Texto legible de una ubicación (p. ej. "Barranquilla, Atlántico"). */
export function formatLocation(loc?: GeoLocation | null): string {
  if (!loc) return "";
  return [loc.city, loc.state].filter(Boolean).join(", ");
}

/** ¿La ubicación tiene al menos país y ciudad? (para validar/mostrar). */
export function hasLocation(loc?: GeoLocation | null): loc is GeoLocation {
  return !!loc && !!loc.country && !!loc.city;
}
