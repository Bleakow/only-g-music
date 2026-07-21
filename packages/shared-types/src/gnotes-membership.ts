/**
 * Entidad de dominio: MEMBRESÍA de G Notes (el escritor inteligente).
 *
 * Modelo FREEMIUM: cualquier usuario autenticado escribe y usa la IA, pero con
 * un TOPE DIARIO de llamadas (autocompletado + herramientas creativas). La
 * membresía —mensual, renovable— QUITA ese tope: IA sin límite.
 *
 * Se persiste en `users/{uid}.gnotesPremium` (escritura SOLO servidor). El
 * conteo diario vive aparte, en `gnotesUsage/{uid}_{YYYY-MM-DD}` (también
 * server-write). Tipos PUROS: no importar UI ni Firebase aquí.
 */

/** Duración de la membresía antes de tener que renovar. Mensual. */
export const GNOTES_DURACION_MESES = 1;

/**
 * Sugerencias de IA gratis por día para un usuario SIN membresía. Cubre el
 * autocompletado (ghost) y las herramientas del panel (rimas/metáforas/…).
 * Generoso para "probar el valor", bajo para empujar a la membresía. Tunable.
 */
export const FREE_AI_LIMIT_DIA = 25;

export interface GNotesMembership {
  activo: boolean;
  /** epoch ms en que se activó/renovó. */
  since: number;
  /** epoch ms en que expira (+1 mes desde la última renovación). */
  expiresAt: number;
  /** Membresía de CORTESÍA: la regaló el admin, sin pago → no genera asiento
   *  contable. Solo distingue el origen; la vigencia funciona igual. */
  cortesia?: boolean;
}

/** Estado de vigencia (derivado, no se persiste). */
export type GNotesEstado = "activo" | "expirado" | "ninguno";

/** Estado de vigencia a partir de la membresía y el instante actual (puro). */
export function gnotesEstado(
  membership: GNotesMembership | null | undefined,
  now: number,
): GNotesEstado {
  if (!membership || !membership.activo) return "ninguno";
  return membership.expiresAt > now ? "activo" : "expirado";
}

/** ¿La membresía está vigente? (IA sin límite). */
export function gnotesActiva(
  membership: GNotesMembership | null | undefined,
  now: number,
): boolean {
  return gnotesEstado(membership, now) === "activo";
}

/**
 * Calcula `since`/`expiresAt` al activar o renovar la membresía (puro). El
 * servidor lo invoca al confirmar el pago; se persiste el resultado.
 */
export function activarGNotes(now: number): GNotesMembership {
  const expira = new Date(now);
  expira.setMonth(expira.getMonth() + GNOTES_DURACION_MESES);
  return { activo: true, since: now, expiresAt: expira.getTime() };
}

/**
 * Clave del documento de conteo diario para un uid en una fecha dada (UTC).
 * Formato `{uid}_{YYYY-MM-DD}`: un doc por usuario y día → el conteo se resetea
 * solo (documentos nuevos) sin cron de limpieza.
 */
export function gnotesUsageDocId(uid: string, now: number): string {
  const d = new Date(now);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${uid}_${yyyy}-${mm}-${dd}`;
}
