/**
 * Entidad de dominio: COLECTIVO (§07 OGM.pen).
 *
 * Un colectivo agrupa talento bajo un mismo nombre: un sello, un movimiento, una
 * agrupación o una academia. Es la primera entidad "de varios" de Only G — todo
 * lo demás (artistas, productores) es de una sola persona.
 *
 * DECISIONES DE MODELADO:
 *
 * 1. Los MIEMBROS son referencias a perfiles de artista existentes (por `slug`),
 *    no personas nuevas. Un colectivo no crea talento: lo agrupa. Mismo patrón
 *    que `relatedArtists`, y así un artista sigue siendo dueño de su perfil
 *    aunque entre o salga de un colectivo.
 *
 * 2. MULTI-PERTENENCIA permitida: un artista puede estar en un sello Y en un
 *    movimiento. La escena real funciona así, y el perfil de artista ya lo
 *    contemplaba (`colectivos?: ColectivoRef[]`).
 *
 * 3. El TIPO cambia el VOCABULARIO, no la estructura. Un sello tiene "artistas"
 *    y "lanzamientos"; un movimiento tiene "miembros" y "lo más sonado". La
 *    página es la misma; las etiquetas las resuelve el i18n por tipo.
 *
 * Módulo PURO: sin Firebase ni UI.
 */
import type { SocialPlatform } from "./artist";
import type { GeoLocation } from "./location";

/** Qué clase de colectivo es. Define el vocabulario de su página. */
export type ColectivoTipo = "sello" | "movimiento" | "agrupacion" | "academia";

export const COLECTIVO_TIPOS: ColectivoTipo[] = [
  "sello",
  "movimiento",
  "agrupacion",
  "academia",
];

/** Terreno en el que se mueve. Es el segundo eje de filtro del directorio. */
export type ColectivoDisciplina = "musica" | "modelaje" | "baile" | "academia";

export const COLECTIVO_DISCIPLINAS: ColectivoDisciplina[] = [
  "musica",
  "modelaje",
  "baile",
  "academia",
];

/** Un integrante: siempre un perfil de artista que ya existe. */
export interface ColectivoMiembro {
  /** `artistProfiles/{slug}` — la fuente de verdad de su foto y su nombre. */
  slug: string;
  /** Papel dentro del colectivo ("Fundador", "Miembro", "Directora"…). */
  rol?: string;
  /** Sale en la fila destacada de la portada del colectivo. */
  destacado?: boolean;
}

/**
 * Cifras de la cabecera. Se guardan calculadas (no se derivan en cada visita):
 * sumar reproducciones de N artistas en tiempo real costaría una lectura por
 * miembro cada vez que alguien abre la página.
 */
export interface ColectivoStats {
  miembros?: number;
  seguidores?: number;
  reproducciones?: number;
  lanzamientos?: number;
  eventos?: number;
  visitas?: number;
}

/** Un lanzamiento o tema destacado del colectivo. */
export interface ColectivoLanzamiento {
  titulo: string;
  /** Artista o artistas que lo firman (texto libre: puede ser una colaboración). */
  artista?: string;
  /** Enlace externo (YouTube/Spotify) o media propia. */
  url?: string;
  coverURL?: string;
  anio?: string;
}

/**
 * Membresía de organización del colectivo (§07, paso 3 del alta).
 *
 * Se cobra la CUOTA del colectivo más un precio por cada cupo de artista. Los
 * cupos son el tope de miembros: para meter al miembro 11 hay que ampliar.
 *
 * Igual que el premium del perfil, vive server-side: la escriben las Functions
 * al confirmar el pago, nunca el cliente.
 */
export interface ColectivoMembresia {
  /** Cupos de artista comprados (incluye a los fundadores). */
  cupos: number;
  /** Milisegundos epoch en que vence. */
  expiresAt: number;
  /** Cuánto se pagó la última vez (COP), para trazabilidad. */
  ultimoPago?: number;
}

/** Cupos mínimos que se pueden comprar: un colectivo de una persona no lo es. */
export const CUPOS_MINIMOS = 2;
/** Presets del selector de cupos en el alta. */
export const CUPOS_PRESETS = [5, 10, 20] as const;
/** Tope duro: por encima de esto, que hablen con el equipo. */
export const CUPOS_MAXIMOS = 100;

/**
 * Total mensual a pagar: la cuota de organización más los cupos.
 * Puro y con los precios INYECTADOS — nunca leídos de una constante — para que
 * el CEO pueda cambiarlos desde su panel sin desplegar.
 */
export function totalMembresia(
  cupos: number,
  precios: { precioColectivo: number; precioCupoColectivo: number },
): number {
  const n = Math.max(CUPOS_MINIMOS, Math.min(CUPOS_MAXIMOS, Math.floor(cupos)));
  return precios.precioColectivo + n * precios.precioCupoColectivo;
}

/** Estado de la membresía en un instante dado. */
export function membresiaEstado(
  m: ColectivoMembresia | null | undefined,
  now: number,
): "activa" | "vencida" | "ninguna" {
  if (!m || !m.expiresAt) return "ninguna";
  return m.expiresAt > now ? "activa" : "vencida";
}

/**
 * ¿Caben más miembros? Sin membresía activa el colectivo existe y se ve, pero
 * no puede crecer: es lo que empuja a pagar sin castigar al que ya está dentro.
 */
export function puedeAgregarMiembro(
  c: Pick<Colectivo, "miembros" | "membresia">,
  now: number,
): boolean {
  if (membresiaEstado(c.membresia, now) !== "activa") return false;
  return (c.miembros?.length ?? 0) < (c.membresia?.cupos ?? 0);
}

/** Cupos libres (0 si no hay membresía activa). */
export function cuposLibres(
  c: Pick<Colectivo, "miembros" | "membresia">,
  now: number,
): number {
  if (membresiaEstado(c.membresia, now) !== "activa") return 0;
  return Math.max(0, (c.membresia?.cupos ?? 0) - (c.miembros?.length ?? 0));
}

export interface Colectivo {
  /** Id del documento = slug. Estable y legible en la URL. */
  slug: string;
  nombre: string;
  tipo: ColectivoTipo;
  disciplina: ColectivoDisciplina;
  /** Quién lo creó. Manda sobre el colectivo junto con `adminUids`. */
  ownerUid: string;
  /** Co-administradores. El admin de Only G siempre puede, sin estar aquí. */
  adminUids?: string[];

  descripcion?: string;
  ciudad?: string;
  location?: GeoLocation;
  /** Color de marca del colectivo (como el `accent` del artista). */
  accent: string;
  logoURL?: string;
  coverURL?: string;

  miembros: ColectivoMiembro[];
  /** Membresía de organización. Server-only: la escriben las Functions al pagar. */
  membresia?: ColectivoMembresia;
  stats?: ColectivoStats;
  lanzamientos?: ColectivoLanzamiento[];
  generos?: string[];
  socials?: Partial<Record<SocialPlatform, string>>;

  /** Fuera de la vitrina si es `false` (sigue accesible por URL directa). */
  visible?: boolean;
  /** Curaduría de Only G — solo admin. Menor primero. */
  orden?: number;

  createdAt?: number;
  updatedAt?: number;
}

/** Lo que se puede editar desde el cliente (el resto lo blindan las reglas). */
export type EditableColectivo = Pick<
  Colectivo,
  | "nombre"
  | "tipo"
  | "disciplina"
  | "descripcion"
  | "ciudad"
  | "location"
  | "accent"
  | "logoURL"
  | "coverURL"
  | "miembros"
  | "lanzamientos"
  | "generos"
  | "socials"
>;

/** Filtro del directorio por tipo. `todos` no filtra. */
export type ColectivoTipoFiltro = ColectivoTipo | "todos";

export const DEFAULT_ACCENT = "#8b5cf6";

/**
 * Iniciales para el logo cuando no hay imagen: "Only G Records" → "OG",
 * "Caribe 2.0" → "C2". Máximo dos caracteres, en mayúscula.
 */
export function inicialesColectivo(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => /[a-z0-9]/i.test(p));
  if (palabras.length === 0) return "?";
  if (palabras.length === 1) {
    return palabras[0].slice(0, 2).toUpperCase();
  }
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

/** Nº de miembros a mostrar. Prefiere el contador guardado; si no, cuenta. */
export function totalMiembros(c: Pick<Colectivo, "miembros" | "stats">): number {
  const guardado = c.stats?.miembros;
  if (typeof guardado === "number" && guardado > 0) return guardado;
  return c.miembros?.length ?? 0;
}

/** Los miembros que van en la fila destacada de la portada. */
export function miembrosDestacados(
  c: Pick<Colectivo, "miembros">,
  limite = 4,
): ColectivoMiembro[] {
  const todos = c.miembros ?? [];
  const marcados = todos.filter((m) => m.destacado);
  // Si nadie está marcado, los primeros sirven: es mejor enseñar cuatro caras
  // que un hueco vacío esperando a que alguien configure la portada.
  return (marcados.length > 0 ? marcados : todos).slice(0, limite);
}

/** ¿Este usuario puede administrar el colectivo? (el admin global, aparte). */
export function puedeGestionar(
  c: Pick<Colectivo, "ownerUid" | "adminUids">,
  uid: string | null | undefined,
): boolean {
  if (!uid) return false;
  if (c.ownerUid === uid) return true;
  return (c.adminUids ?? []).includes(uid);
}

/** ¿El colectivo pasa el filtro de tipo? */
export function matchesTipo(
  c: Pick<Colectivo, "tipo">,
  filtro: ColectivoTipoFiltro,
): boolean {
  return filtro === "todos" || c.tipo === filtro;
}

/** ¿Pasa el filtro de disciplina? `null` = sin filtro. */
export function matchesDisciplina(
  c: Pick<Colectivo, "disciplina">,
  disciplina: ColectivoDisciplina | null,
): boolean {
  return !disciplina || c.disciplina === disciplina;
}

/** Minúsculas sin acentos, para buscar de forma tolerante. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** ¿El texto libre casa con el nombre, la ciudad o la descripción? */
export function matchesTexto(
  c: Pick<Colectivo, "nombre" | "ciudad" | "descripcion">,
  texto: string,
): boolean {
  const q = normalizar(texto.trim());
  if (!q) return true;
  const heno = normalizar(
    [c.nombre, c.ciudad ?? "", c.descripcion ?? ""].join(" "),
  );
  return q.split(/\s+/).every((palabra) => heno.includes(palabra));
}

/**
 * Filtra y ordena el directorio. El orden lo fija la curaduría de Only G
 * (`orden`) y, a igualdad, el nombre — nunca al azar, para que la vitrina se
 * vea igual en cada visita.
 */
export function filtrarColectivos(
  lista: Colectivo[],
  filtros: {
    tipo?: ColectivoTipoFiltro;
    disciplina?: ColectivoDisciplina | null;
    texto?: string;
  } = {},
): Colectivo[] {
  const { tipo = "todos", disciplina = null, texto = "" } = filtros;
  return lista
    .filter(
      (c) =>
        matchesTipo(c, tipo) &&
        matchesDisciplina(c, disciplina) &&
        matchesTexto(c, texto),
    )
    .sort((a, b) => {
      const oa = a.orden ?? Number.MAX_SAFE_INTEGER;
      const ob = b.orden ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return a.nombre.localeCompare(b.nombre);
    });
}
