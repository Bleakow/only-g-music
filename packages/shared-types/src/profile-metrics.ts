/**
 * Métricas del perfil de artista (§04 — panel "Métricas de tu perfil").
 *
 * MODELO DE AGREGACIÓN: no se guarda un documento por evento (sería carísimo de
 * leer y de escribir). Cada evento se convierte en `increment()` sobre DOS docs:
 *
 *   artistProfiles/{slug}/metrics/totals        → acumulado de siempre
 *   artistProfiles/{slug}/metrics/d_YYYY-MM-DD  → un doc por día
 *
 * Así el panel de "últimos 30 días" cuesta 30 lecturas y el histórico total, una.
 *
 * LÍMITE CONOCIDO: Firestore sostiene ~1 escritura/segundo por documento. Un
 * perfil con tráfico masivo saturaría el doc del día; para el volumen de Only G
 * sobra, y si algún día molesta se reparte en shards (`d_..._0..9`).
 *
 * Este módulo es PURO (sin Firebase ni UI): tipos + agregaciones, para poder
 * testearlo y compartirlo entre la API de registro y el panel.
 */

/** Qué se mide. Añadir uno nuevo NO rompe los docs existentes (todo es opcional). */
export type MetricEvent =
  | "visita"
  | "play"
  | "share"
  | "socialClick";

/** Canal por el que se compartió el perfil. */
export type ShareChannel =
  | "whatsapp"
  | "copy"
  | "native"
  /** La estampa con el QR: descargada o mandada como imagen. */
  | "qr"
  | "instagram"
  | "x"
  | "facebook"
  | "otros";

/**
 * Origen de una reproducción. Se distinguen porque NO son comparables: de los
 * reproductores propios sabemos que sonó de verdad; de un embed de Spotify solo
 * sabemos que el visitante lo desplegó (su iframe no emite eventos).
 */
export type PlaySource =
  | "intro"
  | "destacado"
  | "youtube"
  | "spotify";

/** Contadores de un periodo (un día, o el acumulado total). */
export interface MetricsCounters {
  visitas?: number;
  plays?: number;
  shares?: number;
  socialClicks?: number;
  /** Visitas por país ISO-3166-1 alfa-2 en MAYÚSCULAS (`CO`, `US`…). */
  porPais?: Record<string, number>;
  /** Clics por red social (las claves de `SocialPlatform`). */
  porRed?: Record<string, number>;
  /** Compartidos por canal. */
  porCanal?: Record<string, number>;
  /** Reproducciones por tema. La clave es el título normalizado del tema. */
  porCancion?: Record<string, number>;
  /** Reproducciones por origen (propio vs embed): contexto para `plays`. */
  porOrigen?: Record<string, number>;
}

/** Un día de métricas, tal y como vive en Firestore. */
export interface MetricsDay extends MetricsCounters {
  /** `YYYY-MM-DD` en UTC. Es también el id del doc, sin el prefijo `d_`. */
  dia: string;
}

/** Estado de visibilidad de las métricas de un perfil. */
export type MetricsVisibility = "privado" | "enlace" | "publico";

export const DEFAULT_METRICS_VISIBILITY: MetricsVisibility = "privado";

/** Rangos que ofrece el selector del panel. */
export const METRICS_RANGES = [7, 30, 90] as const;
export type MetricsRange = (typeof METRICS_RANGES)[number];
export const DEFAULT_METRICS_RANGE: MetricsRange = 30;

/** Prefijo del id de los docs por día (`d_2026-08-01`). */
export const DAY_DOC_PREFIX = "d_";

/**
 * Clave de día (`YYYY-MM-DD`) en UTC. UTC y no hora local a propósito: el
 * servidor agrega desde cualquier región y los visitantes están en husos
 * distintos; sin un referente único, un mismo evento caería en dos días.
 */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Los `n` días hasta `hasta` (incluido), del más antiguo al más reciente. */
export function lastDayKeys(n: number, hasta: Date): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hasta.getTime() - i * 86_400_000);
    out.push(dayKey(d));
  }
  return out;
}

/** Suma dos mapas de contadores (`{CO: 2}` + `{CO: 3, US: 1}` = `{CO: 5, US: 1}`). */
export function mergeCounts(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
): Record<string, number> {
  const out: Record<string, number> = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) {
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/** Agrega varios días en un único bloque de contadores. */
export function sumDays(days: MetricsCounters[]): MetricsCounters {
  const out: MetricsCounters = {
    visitas: 0,
    plays: 0,
    shares: 0,
    socialClicks: 0,
    porPais: {},
    porRed: {},
    porCanal: {},
    porCancion: {},
    porOrigen: {},
  };
  for (const d of days) {
    out.visitas! += d.visitas ?? 0;
    out.plays! += d.plays ?? 0;
    out.shares! += d.shares ?? 0;
    out.socialClicks! += d.socialClicks ?? 0;
    out.porPais = mergeCounts(out.porPais, d.porPais);
    out.porRed = mergeCounts(out.porRed, d.porRed);
    out.porCanal = mergeCounts(out.porCanal, d.porCanal);
    out.porCancion = mergeCounts(out.porCancion, d.porCancion);
    out.porOrigen = mergeCounts(out.porOrigen, d.porOrigen);
  }
  return out;
}

/** Una fila de ranking ya lista para pintar (con su % relativo al líder). */
export interface RankedEntry {
  key: string;
  value: number;
  /** 0–100: proporción respecto al MAYOR de la lista, para el ancho de la barra. */
  pct: number;
  /** 0–100: proporción respecto al TOTAL, para mostrar "12.4%". */
  share: number;
}

/**
 * Ordena un mapa de contadores de mayor a menor y calcula los porcentajes.
 * `limit` recorta la lista (el panel enseña top 6, top 5…).
 */
export function rank(
  counts: Record<string, number> | undefined,
  limit?: number,
): RankedEntry[] {
  const entries = Object.entries(counts ?? {}).filter(([, v]) => v > 0);
  if (entries.length === 0) return [];
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const max = entries[0][1];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const sliced = limit != null ? entries.slice(0, limit) : entries;
  return sliced.map(([key, value]) => ({
    key,
    value,
    pct: max > 0 ? Math.round((value / max) * 100) : 0,
    share: total > 0 ? (value / total) * 100 : 0,
  }));
}

/**
 * Variación porcentual entre el periodo actual y el anterior de igual tamaño.
 * `null` cuando no hay base con la que comparar (periodo anterior a cero): sin
 * eso, pasar de 0 a 5 visitas mostraría un "+∞%" o un "+500%" sin sentido.
 */
export function deltaPct(actual: number, previo: number): number | null {
  if (previo <= 0) return null;
  return Math.round(((actual - previo) / previo) * 100);
}

/** Serie diaria de una métrica concreta, lista para la gráfica de barras. */
export function series(
  days: MetricsDay[],
  metric: "visitas" | "plays" | "shares" | "socialClicks",
): { dia: string; value: number }[] {
  return days.map((d) => ({ dia: d.dia, value: d[metric] ?? 0 }));
}

/**
 * Bandera emoji a partir del código ISO-3166-1 alfa-2. Los "Regional Indicator
 * Symbols" son A–Z desplazados a U+1F1E6, así que `CO` → 🇨🇴 sin ningún asset ni
 * fuente de iconos. Devuelve "" si el código no es válido.
 */
export function flagEmoji(iso2: string): string {
  const code = iso2?.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code ?? "")) return "";
  return String.fromCodePoint(
    ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}
