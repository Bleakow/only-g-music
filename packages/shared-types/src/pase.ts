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
  /**
   * epoch ms en que el DUEÑO lo reclamó (abrió el hilo con el estudio). Un vale
   * pagado que nadie reclama no es lo mismo que uno en curso: sin esta marca, el
   * estudio no sabe a quién le debe una producción y el artista no sabe si su
   * petición llegó.
   */
  reclamadoAt?: number;
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

// ── Vales (la parte del pase que entrega una persona) ───────────────────────

/** Los dos servicios que se entregan a mano. */
export type ValeId = "produccion" | "video";

export const VALE_IDS: ValeId[] = ["produccion", "video"];

/** ¿Es uno de los dos vales? (guardarraíl para datos crudos/URLs). */
export function esValeId(v: unknown): v is ValeId {
  return v === "produccion" || v === "video";
}

/**
 * Ciclo de vida del vale: nace `pendiente` (pagado pero nadie lo ha pedido),
 * pasa a `reclamado` cuando el dueño abre el hilo con el estudio, y termina en
 * `entregado` cuando el admin lo marca cumplido.
 */
export type ValeEstado = "pendiente" | "reclamado" | "entregado";

/** Estado de un vale (puro). Ausente = no incluido → `pendiente` no aplica. */
export function valeEstado(vale: Vale | null | undefined): ValeEstado {
  if (!vale) return "pendiente";
  if (vale.usado) return "entregado";
  return vale.reclamadoAt ? "reclamado" : "pendiente";
}

/** Un vale del pase, ya resuelto para pintarlo (dueño o admin). */
export interface ValeItem {
  id: ValeId;
  estado: ValeEstado;
  /** Solo el de producción: si es para un solista o una agrupación. */
  alcance?: "artista" | "grupo";
  reclamadoAt?: number;
  entregadoAt?: number;
}

/**
 * Vales que INCLUYE este pase, con su estado (puro). Existe para que el panel
 * del artista y el del admin recorran la misma lista: con el `if (pase.produccion)`
 * repetido en cada pantalla, basta añadir un tercer vale para que una de ellas
 * se olvide de pintarlo.
 */
export function valesDe(pase: Pase | null | undefined): ValeItem[] {
  if (!pase) return [];
  const items: ValeItem[] = [];
  if (pase.produccion) {
    items.push({
      id: "produccion",
      estado: valeEstado(pase.produccion),
      alcance: pase.produccion.alcance,
      reclamadoAt: pase.produccion.reclamadoAt,
      entregadoAt: pase.produccion.entregadoAt,
    });
  }
  if (pase.video) {
    items.push({
      id: "video",
      estado: valeEstado(pase.video),
      reclamadoAt: pase.video.reclamadoAt,
      entregadoAt: pase.video.entregadoAt,
    });
  }
  return items;
}

/** ¿Queda algún vale por entregar? (para el aviso en "Mis cosas"). */
export function tieneValesPorEntregar(pase: Pase | null | undefined): boolean {
  return valesDe(pase).some((v) => v.estado !== "entregado");
}
