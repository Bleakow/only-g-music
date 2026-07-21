/**
 * Entidad de dominio: PASE (paquete/suscripción que agrupa varios beneficios).
 *
 * Un pase NO es un entitlement suelto: al activarlo, el servidor enciende los
 * entitlements temporales que ya existen (membresía de G Notes + perfil de
 * artista premium, ambos +1 mes) Y registra los "vales" de SERVICIO (producción,
 * video) que el estudio entrega a mano y marca como usados. Por eso hay:
 *   - `users/{uid}.gnotesPremium` (lo lee G Notes) — se setea aparte.
 *   - `artistProfiles/{slug}.premium` (lo lee el perfil) — se setea aparte.
 *   - `users/{uid}.pase` (ESTE tipo) — guarda el tier + los vales pendientes.
 *
 * Tipos PUROS: no importar UI ni Firebase aquí.
 */

export type PaseTipo = "lite" | "golden" | "premium";

/** Meses de vigencia de la parte TEMPORAL del pase (G Notes + perfil). */
export const PASE_DURACION_MESES = 1;

/**
 * Especificación de QUÉ incluye cada pase (catálogo puro: pinta las cards y
 * guía la concesión). Producción: `null` = no incluye; "artista" = una producción
 * para un solista; "grupo" = para una agrupación completa.
 */
export interface PaseSpec {
  tipo: PaseTipo;
  /** Membresía de G Notes 1 mes (IA sin límite). */
  gnotes: boolean;
  /** Perfil de artista premium 1 mes (visible en la vitrina). */
  perfil: boolean;
  /** Producción completa incluida, y para quién. `null` = no incluye. */
  produccion: "artista" | "grupo" | null;
  /** Video profesional incluido. */
  video: boolean;
}

/** Catálogo de los 3 pases (única fuente de verdad de sus beneficios). */
export const PASES: Record<PaseTipo, PaseSpec> = {
  lite: {
    tipo: "lite",
    gnotes: true,
    perfil: true,
    produccion: null,
    video: false,
  },
  golden: {
    tipo: "golden",
    gnotes: true,
    perfil: true,
    produccion: "artista",
    video: false,
  },
  premium: {
    tipo: "premium",
    gnotes: true,
    perfil: true,
    produccion: "grupo",
    video: true,
  },
};

export const PASE_TIPOS: PaseTipo[] = ["lite", "golden", "premium"];

/**
 * Vale de un servicio incluido en el pase: lo entrega el estudio a mano (agenda,
 * graba, edita). No caduca con la parte temporal — un beneficio ya pagado no se
 * pierde. `usado` lo marca el admin al cumplirlo.
 */
export interface Vale {
  usado: boolean;
  /** epoch ms en que el admin lo marcó entregado (o ausente). */
  entregadoAt?: number;
}

/** Vale de producción: además del estado, PARA QUIÉN (solista o agrupación). */
export interface ValeProduccion extends Vale {
  alcance: "artista" | "grupo";
}

/**
 * Pase concedido a un usuario (`users/{uid}.pase`). Lo escribe SOLO el servidor
 * (Function al confirmar el pago, o el admin al dar cortesía). El cliente lo lee
 * para mostrar el estado y qué vales le quedan.
 */
export interface Pase {
  tipo: PaseTipo;
  activo: boolean;
  /** epoch ms en que se activó. */
  since: number;
  /** epoch ms en que vence la parte TEMPORAL (+1 mes). Los vales NO vencen. */
  expiresAt: number;
  /** Cortesía: lo activó el admin sin pago → no genera asiento contable. */
  cortesia?: boolean;
  /** Vale de producción (golden/premium). Ausente = el pase no la incluye. */
  produccion?: ValeProduccion;
  /** Vale de video profesional (solo premium). Ausente = no lo incluye. */
  video?: Vale;
}

/** Estado de vigencia de la parte temporal (derivado, no se persiste). */
export type PaseEstado = "activo" | "expirado" | "ninguno";

export function paseEstado(
  pase: Pase | null | undefined,
  now: number,
): PaseEstado {
  if (!pase || !pase.activo) return "ninguno";
  return pase.expiresAt > now ? "activo" : "expirado";
}

/**
 * Construye el registro de pase al activarlo (puro). El servidor lo persiste, y
 * ADEMÁS enciende por separado `gnotesPremium` y el `premium` del perfil (esos
 * los leen G Notes y la vitrina). Aquí solo se arman el tier + los vales.
 */
export function activarPase(
  tipo: PaseTipo,
  now: number,
  cortesia = false,
): Pase {
  const spec = PASES[tipo];
  const expira = new Date(now);
  expira.setMonth(expira.getMonth() + PASE_DURACION_MESES);
  const pase: Pase = {
    tipo,
    activo: true,
    since: now,
    expiresAt: expira.getTime(),
  };
  if (cortesia) pase.cortesia = true;
  if (spec.produccion) {
    pase.produccion = { alcance: spec.produccion, usado: false };
  }
  if (spec.video) pase.video = { usado: false };
  return pase;
}

/** ¿El tier es uno de los 3 válidos? (guardarraíl para datos crudos/URLs). */
export function esPaseTipo(v: unknown): v is PaseTipo {
  return v === "lite" || v === "golden" || v === "premium";
}
