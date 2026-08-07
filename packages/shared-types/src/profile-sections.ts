/**
 * Secciones del perfil dirigidas por ETIQUETAS (§05 — "Editor · Gestor de
 * Secciones" del OGM.pen).
 *
 * LA IDEA. Un perfil no es "de cantante" o "de modelo": es la suma de lo que esa
 * persona hace. Alguien puede ser cantante Y modelo, y entonces su perfil tiene
 * reproductor Y ficha técnica. Por eso NO hay una vista por rol (que obligaría a
 * duplicar el perfil entero por cada disciplina y a elegir una cuando hay varias),
 * sino un catálogo de secciones donde cada etiqueta desbloquea las suyas.
 *
 * Tres estados por sección:
 *   · BASE       — siempre disponible, sea cual sea tu etiqueta.
 *   · DESBLOQUEADA — alguna de tus etiquetas la habilita; tú decides si se ve.
 *   · BLOQUEADA  — necesita una etiqueta que no tienes; se muestra con candado
 *                  para que sepas que existe y qué te falta.
 *
 * Módulo PURO: sin UI ni Firebase, para poder testearlo y compartirlo entre el
 * editor (gestor) y el perfil público (qué se pinta).
 */
import type { Role } from "./user";

/** Identificador estable de una sección. Se guarda en Firestore: no renombrar. */
export type SectionId =
  // Base
  | "sobreMi"
  | "galeria"
  | "redes"
  | "metricas"
  | "mediaDestacada"
  | "relacionados"
  // Cantante
  | "reproductor"
  | "canciones"
  | "generosMusicales"
  // Modelo
  | "book"
  | "portafolio"
  | "fichaTecnica"
  | "reconocimientos"
  // Beatmaker
  | "tiendaBeats"
  // Bailarín
  | "generosBaile"
  | "trayectoria"
  // Presentador
  | "reelPresentaciones";

export interface ProfileSectionDef {
  id: SectionId;
  /**
   * Etiquetas que desbloquean la sección. Vacío = SECCIÓN BASE (siempre
   * disponible). Basta con tener UNA de ellas.
   */
  unlockedBy: Role[];
  /**
   * ¿Aparece encendida la primera vez? Casi todas sí: si tu etiqueta la
   * desbloquea, lo normal es quererla. `reconocimientos` empieza apagada porque
   * un perfil recién creado sin premios que enseñar se ve peor con la sección
   * vacía que sin ella.
   */
  defaultOn: boolean;
}

/**
 * Catálogo. El ORDEN de este array es el orden por defecto de las secciones en
 * el perfil; el artista puede reordenarlas y su preferencia manda.
 */
export const PROFILE_SECTIONS: ProfileSectionDef[] = [
  // ── Base ────────────────────────────────────────────────────────────
  { id: "mediaDestacada", unlockedBy: [], defaultOn: true },
  { id: "galeria", unlockedBy: [], defaultOn: true },
  { id: "sobreMi", unlockedBy: [], defaultOn: true },
  { id: "redes", unlockedBy: [], defaultOn: true },
  { id: "relacionados", unlockedBy: [], defaultOn: true },
  { id: "metricas", unlockedBy: [], defaultOn: true },
  // ── Cantante ────────────────────────────────────────────────────────
  { id: "reproductor", unlockedBy: ["artista"], defaultOn: true },
  { id: "canciones", unlockedBy: ["artista"], defaultOn: true },
  { id: "generosMusicales", unlockedBy: ["artista", "dj"], defaultOn: true },
  // ── Modelo ──────────────────────────────────────────────────────────
  // `book` (§10) es el portafolio inmersivo: una pieza aparte, a pantalla
  // completa, con su propia ruta. Va ENCENDIDA por defecto aunque no haya nada
  // montado —al revés que `reconocimientos`— porque apagarla escondería también
  // el editor, y una modelo no puede descubrir una sección que no ve. Lo que
  // decide si el visitante ve algo es `bookPublicado`, que solo se enciende
  // cuando el book es publicable.
  { id: "book", unlockedBy: ["modelo"], defaultOn: true },
  { id: "portafolio", unlockedBy: ["modelo"], defaultOn: true },
  { id: "fichaTecnica", unlockedBy: ["modelo"], defaultOn: true },
  { id: "reconocimientos", unlockedBy: ["modelo"], defaultOn: false },
  // ── Beatmaker ───────────────────────────────────────────────────────
  { id: "tiendaBeats", unlockedBy: ["beatmaker"], defaultOn: true },
  // ── Bailarín ────────────────────────────────────────────────────────
  { id: "generosBaile", unlockedBy: ["bailarin"], defaultOn: true },
  { id: "trayectoria", unlockedBy: ["bailarin"], defaultOn: true },
  // ── Presentador ─────────────────────────────────────────────────────
  { id: "reelPresentaciones", unlockedBy: ["presentador"], defaultOn: true },
];

const BY_ID = new Map(PROFILE_SECTIONS.map((s) => [s.id, s]));

/** Definición de una sección por su id. */
export function sectionDef(id: SectionId): ProfileSectionDef | undefined {
  return BY_ID.get(id);
}

/** ¿Es una sección base (disponible sin ninguna etiqueta)? */
export function isBaseSection(def: ProfileSectionDef): boolean {
  return def.unlockedBy.length === 0;
}

/** ¿Las etiquetas dadas desbloquean esta sección? */
export function isUnlocked(
  def: ProfileSectionDef,
  disciplines: Role[] | undefined,
): boolean {
  if (isBaseSection(def)) return true;
  const tags = disciplines ?? [];
  return def.unlockedBy.some((r) => tags.includes(r));
}

/**
 * Preferencias del artista: qué secciones ha encendido o apagado. Se guarda
 * como mapa parcial — lo que no está usa su `defaultOn`, así que añadir una
 * sección nueva al catálogo no obliga a migrar los perfiles existentes.
 */
export type SectionPrefs = Partial<Record<SectionId, boolean>>;

/** ¿Está encendida esta sección para el artista? */
export function isSectionOn(
  id: SectionId,
  prefs: SectionPrefs | undefined,
  disciplines: Role[] | undefined,
): boolean {
  const def = BY_ID.get(id);
  if (!def) return false;
  if (!isUnlocked(def, disciplines)) return false; // bloqueada = nunca se pinta
  return prefs?.[id] ?? def.defaultOn;
}

/** Las tres listas que pinta el gestor del editor. */
export interface SectionGroups {
  base: ProfileSectionDef[];
  unlocked: ProfileSectionDef[];
  /** Con la etiqueta que hace falta para desbloquearla (la primera de la lista). */
  locked: { def: ProfileSectionDef; requires: Role }[];
}

/**
 * Agrupa el catálogo según las etiquetas del artista. `locked` conserva qué
 * etiqueta falta para poder ofrecer "añadir {etiqueta}" en vez de un candado
 * mudo que no explica nada.
 */
export function groupSections(disciplines: Role[] | undefined): SectionGroups {
  const tags = disciplines ?? [];
  const base: ProfileSectionDef[] = [];
  const unlocked: ProfileSectionDef[] = [];
  const locked: { def: ProfileSectionDef; requires: Role }[] = [];

  for (const def of PROFILE_SECTIONS) {
    if (isBaseSection(def)) base.push(def);
    else if (def.unlockedBy.some((r) => tags.includes(r))) unlocked.push(def);
    else locked.push({ def, requires: def.unlockedBy[0] });
  }
  return { base, unlocked, locked };
}

/**
 * Secciones que se PINTAN en el perfil público, en orden. Respeta el orden
 * guardado por el artista y deja al final las que no estén en él (una sección
 * nueva del catálogo aparece sin romper el orden existente).
 */
export function visibleSections(
  disciplines: Role[] | undefined,
  prefs: SectionPrefs | undefined,
  order: SectionId[] | undefined,
): SectionId[] {
  const activas = PROFILE_SECTIONS.filter((d) =>
    isSectionOn(d.id, prefs, disciplines),
  ).map((d) => d.id);

  if (!order || order.length === 0) return activas;

  const set = new Set(activas);
  const ordenadas = order.filter((id) => set.has(id));
  const resto = activas.filter((id) => !order.includes(id));
  return [...ordenadas, ...resto];
}
