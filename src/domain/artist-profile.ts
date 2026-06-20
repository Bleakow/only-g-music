/**
 * Entidad de dominio: Perfil de Artista. Tipos + lógica PURA (niveles, insignia,
 * vigencia premium, trayectoria). Portable: sin UI ni Firebase aquí.
 *
 * DOS EJES ORTOGONALES (decisión de arquitectura):
 *   1. Insignia / Nivel → reputación GANADA por actividad. Permanente.
 *   2. Premium          → entitlement PAGADO. Expira a los 2 meses, renovable.
 *
 * El pago otorga PUNTOS (bonus de reputación), pero NO compra la insignia: así
 * la insignia sigue significando "este artista está vivo en la comunidad" y no
 * "este artista tiene plata". El premium es lo que hace visible el perfil full
 * en la vitrina; la insignia desbloquea descuentos/funciones.
 *
 * Fuente de verdad: `puntos` (la insignia se DERIVA, no se persiste, para no
 * desincronizarse). Los likes se DERIVAN del tamaño de la subcolección.
 */

import type { SocialPlatform } from "./artist";

// ── Insignia / Nivel (eje 1: reputación ganada) ─────────────────────────────

/** Niveles de reputación, de menor a mayor. */
export type Insignia = "plata" | "oro" | "diamante";

/** Orden ascendente — usado para calcular el siguiente nivel. */
export const INSIGNIAS: Insignia[] = ["plata", "oro", "diamante"];

/** Puntos mínimos para alcanzar cada insignia. */
export const UMBRAL_INSIGNIA: Record<Insignia, number> = {
  plata: 0,
  oro: 500,
  diamante: 2000,
};

export interface InsigniaMeta {
  id: Insignia;
  label: string;
  /** Color de acento para la UI (hex). */
  color: string;
  /** Descuento (%) en producciones que desbloquea este nivel. */
  descuentoPct: number;
}

export const INSIGNIA_META: Record<Insignia, InsigniaMeta> = {
  plata: { id: "plata", label: "Plata", color: "#c0c4cc", descuentoPct: 0 },
  oro: { id: "oro", label: "Oro", color: "#d4af37", descuentoPct: 5 },
  diamante: { id: "diamante", label: "Diamante", color: "#8b5cf6", descuentoPct: 10 },
};

/**
 * Puntos que otorga cada tipo de actividad. Fuente única de la gamificación.
 * En 15a estos puntos los ajusta el admin; en 15c los aplica una Cloud Function
 * server-authoritative (reacciones/colaboraciones/pagos) — el cliente nunca
 * edita sus propios puntos (lo garantizan las reglas de Firestore).
 */
export const PUNTOS = {
  likeRecibido: 5,
  colaboracion: 50,
  pagoProduccion: 100,
  pagoPerfil: 150,
} as const;

/** Insignia correspondiente a una cantidad de puntos (puro). */
export function insigniaDePuntos(puntos: number): Insignia {
  if (puntos >= UMBRAL_INSIGNIA.diamante) return "diamante";
  if (puntos >= UMBRAL_INSIGNIA.oro) return "oro";
  return "plata";
}

/** Nivel actual, siguiente nivel y cuántos puntos faltan (null si es el máximo). */
export function progresoInsignia(puntos: number): {
  actual: Insignia;
  siguiente: Insignia | null;
  faltan: number;
} {
  const actual = insigniaDePuntos(puntos);
  const siguiente = INSIGNIAS[INSIGNIAS.indexOf(actual) + 1] ?? null;
  const faltan = siguiente ? Math.max(0, UMBRAL_INSIGNIA[siguiente] - puntos) : 0;
  return { actual, siguiente, faltan };
}

// ── Premium (eje 2: entitlement pagado) ─────────────────────────────────────

/** Duración del perfil premium antes de tener que renovar. */
export const PREMIUM_DURACION_MESES = 2;

export interface Premium {
  activo: boolean;
  /** epoch ms en que se activó/renovó. */
  since: number;
  /** epoch ms en que expira (+2 meses desde la última renovación). */
  expiresAt: number;
}

/** Estado de vigencia (derivado, no se persiste). */
export type PremiumEstado = "activo" | "expirado" | "ninguno";

/** Estado de vigencia a partir del premium y el instante actual (puro). */
export function premiumEstado(
  premium: Premium | null | undefined,
  now: number,
): PremiumEstado {
  if (!premium || !premium.activo) return "ninguno";
  return premium.expiresAt > now ? "activo" : "expirado";
}

/** ¿El perfil debe mostrarse en la vitrina pública? (premium vigente). */
export function perfilVisible(
  profile: Pick<ArtistProfile, "premium">,
  now: number,
): boolean {
  return premiumEstado(profile.premium, now) === "activo";
}

/**
 * Calcula `since`/`expiresAt` al activar o renovar el premium (puro). El admin
 * lo invoca al confirmar el pago; se persiste el resultado.
 */
export function activarPremium(now: number): Premium {
  const expira = new Date(now);
  expira.setMonth(expira.getMonth() + PREMIUM_DURACION_MESES);
  return { activo: true, since: now, expiresAt: expira.getTime() };
}

// ── Trayectoria ─────────────────────────────────────────────────────────────

/** Años de trayectoria a partir del año de inicio (puro). */
export function aniosDeTrayectoria(startYear: number, now: number): number {
  return Math.max(0, new Date(now).getFullYear() - startYear);
}

/** Slug URL-safe a partir de un nombre ("Bad Bunny" → "bad-bunny"). Puro. */
export function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Multimedia ──────────────────────────────────────────────────────────────

/** Plataforma de reproducción de un tema. El visitante elige cuál ver. */
export type TrackPlatform = "youtube" | "spotify";

/**
 * Tema destacado. Puede tener link en una o ambas plataformas; el VISITANTE
 * elige con cuál reproducir (al menos una debe estar presente para sonar).
 */
export interface ProfileTrack {
  title: string;
  /** Link en YouTube (watch?v=… / youtu.be/…). Opcional. */
  youtubeUrl?: string;
  /** Link en Spotify (open.spotify.com/track/…). Opcional. */
  spotifyUrl?: string;
}

// ── Entidad ─────────────────────────────────────────────────────────────────

export interface ArtistProfile {
  /** Identificador en la URL: /artistas/<slug> */
  slug: string;
  /** UID del usuario dueño (enlace con users/{uid}). */
  uid: string;

  // Identidad PÚBLICA. El nombre real y la fecha de nacimiento son PRIVADOS y
  // viven SOLO en users/{uid}; nunca se exponen aquí.
  artisticName: string;
  /** Frase célebre (debajo del nombre). */
  tagline: string;
  genre: string;
  city?: string;
  bio: string;
  /** Color de acento para teñir su página (hex). */
  accent: string;

  // Multimedia
  /** Foto de perfil — OBLIGATORIA. */
  photoURL: string;
  /** Galería de mejores fotos artísticas. */
  gallery: string[];
  /** Temas destacados (botones de reproducción YouTube/Spotify). */
  tracks: ProfileTrack[];
  /** Tema que suena al primer tap del visitante (autoplay con sonido está bloqueado por el navegador). */
  entryTrackUrl?: string;

  /** Links directos a todas sus redes. */
  socials: Partial<Record<SocialPlatform, string>>;

  /** Año en que empezó su trayectoria (los años se derivan). */
  trajectoryStartYear: number;

  // Gamificación. `puntos` es la fuente de verdad; la insignia se DERIVA con
  // insigniaDePuntos(). NO editable por el cliente (solo admin/Functions).
  puntos: number;

  // Premium pagado. Lo activa admin al confirmar el pago (o Functions).
  premium: Premium | null;

  createdAt: number;
  updatedAt: number;
}

/**
 * Subconjunto que el ARTISTA puede editar de su propio perfil. Excluye los
 * campos sensibles (uid, slug, puntos, premium, timestamps) que solo cambian
 * admin/Functions — esto se refleja además en las reglas de Firestore.
 */
export type EditableProfile = Pick<
  ArtistProfile,
  | "artisticName"
  | "tagline"
  | "genre"
  | "city"
  | "bio"
  | "accent"
  | "photoURL"
  | "gallery"
  | "tracks"
  | "entryTrackUrl"
  | "socials"
  | "trajectoryStartYear"
>;
