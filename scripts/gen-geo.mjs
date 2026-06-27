/**
 * Genera los datasets de ubicación (CO + US) recortados desde `country-state-city`
 * (devDependency) hacia JSON propios bajo src/features/location/data/. SOLO se
 * commitea el JSON resultante, no el paquete en runtime → bundle ligero y sin
 * dependencias en producción. Para regenerar/añadir países: ajustar COUNTRIES y
 * correr `node scripts/gen-geo.mjs`.
 */
import { State, City } from "country-state-city";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src", "features", "location", "data");

const COUNTRIES = ["CO", "US"];

function buildCountry(countryCode) {
  const states = State.getStatesOfCountry(countryCode)
    .map((s) => {
      const cities = [
        ...new Set(
          City.getCitiesOfState(countryCode, s.isoCode).map((c) => c.name),
        ),
      ].sort((a, b) => a.localeCompare(b));
      return { code: s.isoCode, name: s.name, cities };
    })
    .filter((s) => s.cities.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { country: countryCode, states };
}

mkdirSync(OUT_DIR, { recursive: true });

for (const cc of COUNTRIES) {
  const data = buildCountry(cc);
  const file = join(OUT_DIR, `${cc.toLowerCase()}.json`);
  writeFileSync(file, JSON.stringify(data));
  const cities = data.states.reduce((n, s) => n + s.cities.length, 0);
  console.log(
    `${cc}: ${data.states.length} estados, ${cities} ciudades → ${file}`,
  );
}
