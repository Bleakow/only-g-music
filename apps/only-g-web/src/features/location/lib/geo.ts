/**
 * Carga PEREZOSA del dataset de ubicación por país. Cada país es un chunk aparte
 * (dynamic import) → el cliente solo descarga el país que abre, no todos. Se
 * cachea en memoria para no re-importar. Los JSON los genera `scripts/gen-geo.mjs`.
 */
import type { CountryCode } from "@/domain/location";

export interface StateGeo {
  code: string;
  name: string;
  cities: string[];
}

export interface CountryGeo {
  country: string;
  states: StateGeo[];
}

const cache = new Map<CountryCode, CountryGeo>();

export async function loadCountryGeo(code: CountryCode): Promise<CountryGeo> {
  const cached = cache.get(code);
  if (cached) return cached;
  // Specifiers literales (no variables) para que el bundler haga el code-split.
  const mod =
    code === "CO"
      ? await import("../data/co.json")
      : await import("../data/us.json");
  const data = (mod.default ?? mod) as CountryGeo;
  cache.set(code, data);
  return data;
}
