/**
 * Entidad de dominio: PEDIDO — compra directa de uno o varios servicios de precio
 * fijo, con UN solo pago. Agrupa varias líneas; cada línea se materializa como una
 * Reserva (las de `sesion` con slot de agenda; las de `entregable` —mezcla, máster—
 * sin fecha). El Pedido lleva el pago único que, al confirmarse el comprobante,
 * confirma TODAS sus reservas de golpe. Así reutilizamos toda la maquinaria de
 * reservas (contabilidad, sesiones del productor, payouts) sin duplicarla.
 *
 * Diferencia clave con la Cotización: aquí el precio es CONOCIDO → el usuario paga
 * directo sin esperar contraoferta. La revisión humana permanece solo en el
 * comprobante de pago (no en el precio). Tipos + transiciones PUROS: no importar
 * UI ni Firebase aquí.
 */
import type { SedeId } from "./sede";
import type { PricingModel } from "./service";

/**
 * Naturaleza de una línea del pedido:
 * - `sesion`: ocupa un slot de estudio (grabación por hora) → requiere fecha/horas.
 * - `entregable`: no ocupa agenda (mezcla/máster por canción) → solo cantidad.
 */
export type LineaTipo = "sesion" | "entregable";

/** Deriva el tipo de línea del modelo de precio: `por_hora` es sesión; el resto,
 *  entregable. (Los `a_cotizar` no entran a un pedido: van por cotización.) */
export function lineaTipoDe(pricing: PricingModel): LineaTipo {
  return pricing === "por_hora" ? "sesion" : "entregable";
}

export interface PedidoLinea {
  serviceSlug: string;
  serviceName: string;
  /** Variante elegida, si el servicio tiene opciones con precio. */
  variantId?: string;
  tipo: LineaTipo;
  pricing: PricingModel;
  /** Horas (sesión) o unidades/canciones (entregable). Mínimo 1. */
  cantidad: number;
  /** Precio unitario en COP (por hora o por unidad). */
  precioUnitario: number;
  /** `cantidad * precioUnitario`. */
  subtotal: number;
  // ── Agenda (solo `sesion`) ──
  /** Inicio de la cita (epoch ms). */
  start?: number;
  /** Duración en minutos. */
  durationMin?: number;
  /** Reserva que materializa esta línea (se llena al crear el pedido). */
  reservaId?: string;
}

export type PedidoEstado =
  | "pendiente_pago"
  | "pago_en_revision"
  | "confirmado"
  | "cancelado";

export interface Pedido {
  id: string;
  /** Cliente dueño del pedido. */
  uid: string;
  /** Sede única del pedido (agenda de las sesiones + destino de pago). */
  sede: SedeId;
  lineas: PedidoLinea[];
  /** Suma de subtotales (COP). Server-authoritative al confirmar. */
  total: number;
  /** Datos del cliente denormalizados (para tablas/finanzas del admin). */
  clientName?: string;
  clientEmail?: string;
  /** Conversación de pago asociada (chat del comprobante). */
  paymentConversationId?: string;
  comprobanteUrl?: string;
  estado: PedidoEstado;
  createdAt: number;
}

/** Datos que aporta el cliente al crear un pedido (id/estado/fecha los pone el sistema). */
export type NewPedido = Omit<Pedido, "id" | "estado" | "createdAt">;

// ── Cálculo (puro) ──────────────────────────────────────────────────

/** Cantidad saneada: entero ≥ 1. */
export function cantidadSana(cantidad: number): number {
  return Math.max(1, Math.round(cantidad || 0));
}

/** Subtotal de una línea (precio unitario × cantidad saneada). */
export function subtotalLinea(precioUnitario: number, cantidad: number): number {
  return precioUnitario * cantidadSana(cantidad);
}

/** Total del pedido: suma de subtotales. */
export function totalPedido(lineas: Pick<PedidoLinea, "subtotal">[]): number {
  return lineas.reduce((s, l) => s + l.subtotal, 0);
}

/** ¿Alguna línea es una sesión? → hace falta el paso de fecha/agenda. */
export function tieneSesion(lineas: Pick<PedidoLinea, "tipo">[]): boolean {
  return lineas.some((l) => l.tipo === "sesion");
}

// ── Máquina de estados (espeja el ciclo de pago de la Reserva) ───────
// El cliente solo dispara pendiente_pago → pago_en_revision (subir comprobante);
// confirmar/cancelar las hace el admin.
const PEDIDO_TRANSITIONS: Record<PedidoEstado, PedidoEstado[]> = {
  pendiente_pago: ["pago_en_revision", "cancelado"],
  pago_en_revision: ["confirmado", "pendiente_pago", "cancelado"],
  confirmado: [],
  cancelado: [],
};

/** Estados alcanzables desde `estado`. */
export function nextPedidoStates(estado: PedidoEstado): PedidoEstado[] {
  return PEDIDO_TRANSITIONS[estado];
}

/** ¿Es válida la transición `from → to`? */
export function canPedidoTransition(
  from: PedidoEstado,
  to: PedidoEstado,
): boolean {
  return PEDIDO_TRANSITIONS[from].includes(to);
}
