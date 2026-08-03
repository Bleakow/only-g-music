/**
 * Genera el mapa mundial del panel de Métricas (§04) como paths SVG ya
 * proyectados, indexados por código ISO alfa-2.
 *
 * POR QUÉ PRECOMPUTAR. La alternativa era llevar `d3-geo` + `topojson-client` +
 * el TopoJSON al navegador y proyectar en runtime: ~150 KB de dependencias para
 * dibujar un mapa que nunca cambia. Aquí se proyecta UNA vez, en desarrollo, y
 * la app solo carga un archivo de cadenas `d`. Las tres librerías quedan como
 * devDependencies y no pisan el bundle.
 *
 * Uso:  node scripts/generate-world-map.mjs
 * Salida: apps/only-g-web/src/features/artists/components/metrics/world-paths.ts
 *
 * Regenerar solo si se cambia la proyección o la resolución del atlas.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { geoPath, geoNaturalEarth1 } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const world = require("world-atlas/countries-110m.json");

const OUT_W = 900;
const OUT_H = 460;

/**
 * ISO numérico → alfa-2 para lo que `Intl.DisplayNames` no puede casar por
 * nombre: el atlas abrevia ("W. Sahara", "Dem. Rep. Congo") o usa exónimos.
 *
 * OJO con las claves: el atlas trae los ids CON ceros a la izquierda ("090",
 * "070"), así que van entre comillas. Escribirlas como número las convertiría en
 * "90"/"70" y no casarían nunca — silenciosamente, dejando países fuera del mapa.
 *
 * El script avisa de cualquiera que quede sin mapear.
 */
const MANUAL = {
  "010": "AQ", // Antarctica
  "044": "BS", // Bahamas
  "070": "BA", // Bosnia and Herz.
  "090": "SB", // Solomon Is.
  104: "MM", // Myanmar
  140: "CF", // Central African Rep.
  158: "TW", // Taiwan
  178: "CG", // Congo
  180: "CD", // Dem. Rep. Congo
  203: "CZ", // Czechia
  214: "DO", // Dominican Rep.
  222: "SV", // El Salvador
  226: "GQ", // Eq. Guinea
  238: "FK", // Falkland Is.
  242: "FJ", // Fiji
  260: "TF", // Fr. S. Antarctic Lands
  270: "GM", // Gambia
  275: "PS", // Palestine
  304: "GL", // Greenland
  384: "CI", // Côte d'Ivoire
  408: "KP", // North Korea
  410: "KR", // South Korea
  418: "LA", // Laos
  478: "MR", // Mauritania
  498: "MD", // Moldova
  516: "NA", // Namibia (¡ojo! "NA" es Namibia, no un valor nulo)
  528: "NL", // Netherlands
  548: "VU", // Vanuatu
  598: "PG", // Papua New Guinea
  626: "TL", // Timor-Leste
  688: "RS", // Serbia
  704: "VN", // Vietnam
  728: "SS", // S. Sudan
  732: "EH", // W. Sahara
  756: "CH", // Switzerland
  760: "SY", // Syria
  780: "TT", // Trinidad and Tobago
  792: "TR", // Turkey / Türkiye
  807: "MK", // North Macedonia
  834: "TZ", // Tanzania
  840: "US", // United States of America
};

/**
 * Territorios de facto SIN código ISO propio. No se dibujan: no hay forma de
 * atribuirles una visita (el navegador nunca dirá "estoy en Somalilandia") y
 * pintarlos como país sería tomar partido en una disputa que no nos toca.
 */
const SKIP_NAMES = new Set(["N. Cyprus", "Somaliland"]);

const dn = new Intl.DisplayNames(["en"], { type: "region" });
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const byName = new Map();
for (const a of LETTERS) {
  for (const b of LETTERS) {
    const code = a + b;
    const name = dn.of(code);
    if (name && name !== code) byName.set(normalize(name), code);
  }
}

function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z]/g, "");
}

const fc = feature(world, world.objects.countries);
// Natural Earth 1: el compromiso clásico entre no deformar áreas (Mercator
// hincha Groenlandia hasta el ridículo) y seguir siendo reconocible.
const projection = geoNaturalEarth1().fitSize([OUT_W, OUT_H], fc);
const path = geoPath(projection);

const entries = [];
const unmapped = [];
for (const f of fc.features) {
  const id = String(f.id);
  const name = f.properties?.name ?? "";
  if (SKIP_NAMES.has(name)) continue;
  const iso2 = MANUAL[id] ?? byName.get(normalize(name)) ?? null;
  const d = path(f);
  if (!d) continue;
  if (!iso2) {
    unmapped.push(`${id} — ${name}`);
    continue;
  }
  // 2 decimales: a 900px de ancho, más precisión no se ve y engorda el archivo.
  entries.push([iso2, d.replace(/(\d+\.\d{2})\d+/g, "$1")]);
}

entries.sort((a, b) => a[0].localeCompare(b[0]));

const file = `// GENERADO POR scripts/generate-world-map.mjs — NO EDITAR A MANO.
// Paths del mapamundi ya proyectados (Natural Earth 1) en un lienzo de
// ${OUT_W}×${OUT_H}, indexados por ISO-3166-1 alfa-2. Precomputado para no
// llevar d3-geo ni el TopoJSON al navegador.

export const WORLD_VIEWBOX = "0 0 ${OUT_W} ${OUT_H}";

export const WORLD_PATHS: Record<string, string> = {
${entries.map(([iso, d]) => `  ${iso}: "${d}",`).join("\n")}
};
`;

const here = dirname(fileURLToPath(import.meta.url));
const out = join(
  here,
  "..",
  "apps",
  "only-g-web",
  "src",
  "features",
  "artists",
  "components",
  "metrics",
  "world-paths.ts",
);
writeFileSync(out, file, "utf8");

console.log(`Países escritos: ${entries.length}`);
console.log(`Tamaño: ${(file.length / 1024).toFixed(0)} KB`);
if (unmapped.length) {
  console.log(`\nSIN MAPEAR (añádelos a MANUAL):`);
  for (const u of unmapped) console.log("  " + u);
}
