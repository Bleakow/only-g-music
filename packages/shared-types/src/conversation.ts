/**
 * Entidad de dominio: Conversación (chat) generalizada. Reemplaza el modelo
 * parent-bound (quotes/bookings/{id}/messages) por `conversations/{id}` con
 * participantes, tipo y estado, más una subcolección `messages`.
 *
 * Soporta tres tipos sobre la MISMA base:
 *  - "soporte": cliente ↔ estudio (atado a una cotización/reserva vía `ref`).
 *  - "pago": máquina de estados de un pago (premium, etc.) con confirmación
 *    server-authoritative del admin.
 *  - "directo": chat usuario ↔ usuario (futuro).
 *
 * Tipos puros y portables: NO importar nada de UI ni de Firebase aquí.
 */
import type { MetodoPago } from "./payment-method";

export type ConversationType = "soporte" | "pago" | "directo";

/**
 * Estado del hilo. Gobierna quién puede escribir:
 *  - "abierto": los participantes pueden escribir.
 *  - "esperando_confirmacion": en espera de una acción del estudio (p. ej. un
 *    pago anunciado en sede que el equipo confirma); el cliente no escribe.
 *  - "cerrado": hilo finalizado, queda en el historial, nadie escribe.
 */
export type ConversationStatus =
  | "abierto"
  | "esperando_confirmacion"
  | "cerrado";

/** Autor de un mensaje: el UID del usuario, o "sistema" (mensajes automáticos). */
export type MessageFrom = string;

export type MessageTipo =
  | "mensaje" // texto libre de un participante
  | "propuesta" // propuesta del estudio con precio (cotizaciones)
  | "estado" // aviso de cambio de estado (se guarda el código, se traduce al leer)
  | "pago_confirmado"; // confirmación del pago (cierra el hilo)

export interface ConversationMessage {
  id: string;
  /** UID del autor, o "sistema". */
  from: MessageFrom;
  tipo: MessageTipo;
  texto?: string;
  /** Adjunto (archivo) subido a Storage. */
  attachmentUrl?: string;
  attachmentName?: string;
  /** Código de estado (cuando `tipo === "estado"`): se traduce al pintarlo. */
  estado?: string;
  /** Monto en COP (contexto de pago). */
  monto?: number;
  /** Precio propuesto en COP (cuando `tipo === "propuesta"`). */
  price?: number;
  createdAt: number;
}

export type NewConversationMessage = Omit<
  ConversationMessage,
  "id" | "createdAt"
>;

// ── Pago (máquina de estados, solo type "pago") ─────────────────────────────

export type PagoConcepto =
  | "premium"
  | "reserva"
  | "beat"
  | "pedido"
  | "gnotes"
  | "pase"
  /** Membresía de organización de un colectivo + sus cupos de artista (§07). */
  | "colectivo";

/**
 * Estados del pago. La vía normal es la PASARELA (`pendiente_pasarela` → lo
 * resuelve Wompi). `en_revision` es el pago EN SEDE: no hay nada que cobrar por
 * internet, solo dinero que el equipo confirma cuando lo recibe.
 */
export type PagoEstado =
  | "en_revision" // pago en sede anunciado, el equipo lo confirma al recibirlo
  | "pendiente_pasarela" // Wompi: transacción abierta, esperando su veredicto
  | "confirmado" // pago cobrado (webhook de Wompi, o el equipo si fue en sede)
  | "rechazado"; // rechazado (el cliente puede reintentar)

/** ¿Este pago lo resuelve la pasarela y no una persona? */
export function esPagoDePasarela(estado: PagoEstado): boolean {
  return estado === "pendiente_pasarela";
}

export interface PagoState {
  concepto: PagoConcepto;
  /** Monto a pagar en COP. */
  monto: number;
  /** Solo en los pagos EN SEDE (`efectivo`); ausente si va por pasarela. */
  metodo?: MetodoPago;
  estado: PagoEstado;
}

export interface ConversationPreview {
  tipo: MessageTipo;
  texto?: string;
  from: MessageFrom;
  createdAt: number;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  /** UIDs de los participantes (cliente, admin/estudio, etc.). */
  participants: string[];
  status: ConversationStatus;
  /** Enlace opcional a la entidad de contexto. */
  ref?: {
    kind:
      | "quote"
      | "booking"
      | "premium"
      | "beat"
      | "pedido"
      | "gnotes"
      | "pase"
      /** `id` = slug del colectivo. */
      | "colectivo";
    id: string;
  };
  /** Estado del pago (solo `type === "pago"`). */
  pago?: PagoState;
  /** Resumen del último mensaje (para listar conversaciones sin leer su hilo). */
  lastMessage?: ConversationPreview;
  createdAt: number;
  updatedAt: number;
}

export type NewConversation = Omit<
  Conversation,
  "id" | "createdAt" | "updatedAt" | "lastMessage"
>;

// ── Helpers puros ───────────────────────────────────────────────────────────

/** ¿Se puede escribir en esta conversación? Solo cuando está "abierto". */
export function puedeEscribir(
  conversation: Pick<Conversation, "status">,
): boolean {
  return conversation.status === "abierto";
}

/** ¿El UID participa en la conversación? */
export function esParticipante(
  conversation: Pick<Conversation, "participants">,
  uid: string | null | undefined,
): boolean {
  return !!uid && conversation.participants.includes(uid);
}

/**
 * Estado del hilo derivado del estado del pago. Server-authoritative de punta a
 * punta: el cliente abre el hilo y ahí acaba su parte.
 */
export function statusDePago(estado: PagoEstado): ConversationStatus {
  switch (estado) {
    case "en_revision":
      return "esperando_confirmacion";
    case "confirmado":
      return "cerrado";
    default:
      // pendiente_pasarela | rechazado → el hilo sigue abierto porque el cliente
      // puede reintentar. `pendiente_pasarela` NO es "esperando_confirmacion":
      // ahí no hay nadie a quien esperar, resuelve Wompi.
      return "abierto";
  }
}
