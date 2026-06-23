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

export type ConversationType = "soporte" | "pago" | "directo";

/**
 * Estado del hilo. Gobierna quién puede escribir:
 *  - "abierto": los participantes pueden escribir.
 *  - "esperando_confirmacion": en espera de una acción del estudio (p. ej. el
 *    cliente envió el comprobante y el admin lo revisa); el cliente no escribe.
 *  - "cerrado": hilo finalizado, queda en el historial, nadie escribe.
 */
export type ConversationStatus = "abierto" | "esperando_confirmacion" | "cerrado";

/** Autor de un mensaje: el UID del usuario, o "sistema" (mensajes automáticos). */
export type MessageFrom = string;

export type MessageTipo =
  | "mensaje" // texto libre de un participante
  | "comprobante" // adjunto de pago subido por el cliente
  | "propuesta" // propuesta del estudio con precio (cotizaciones)
  | "estado" // aviso de cambio de estado (se guarda el código, se traduce al leer)
  | "metodo" // el cliente eligió un método de pago
  | "pago_confirmado"; // confirmación del admin (cierra el hilo)

export interface ConversationMessage {
  id: string;
  /** UID del autor, o "sistema". */
  from: MessageFrom;
  tipo: MessageTipo;
  texto?: string;
  /** Adjunto (comprobante, archivo) subido a Storage. */
  attachmentUrl?: string;
  attachmentName?: string;
  /** Código de estado (cuando `tipo === "estado"`): se traduce al pintarlo. */
  estado?: string;
  /** Método elegido (cuando `tipo === "metodo"`). */
  metodo?: PagoMetodo;
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

export type PagoMetodo = "nequi" | "bancolombia" | "llave" | "efectivo";
export type PagoConcepto = "premium";

export type PagoEstado =
  | "metodo_pendiente" // el cliente aún no elige método
  | "comprobante_pendiente" // método elegido, falta subir comprobante
  | "en_revision" // comprobante enviado, el admin revisa
  | "confirmado" // el admin confirmó el pago
  | "rechazado"; // el admin rechazó (el cliente puede reintentar)

export interface PagoState {
  concepto: PagoConcepto;
  /** Monto a pagar en COP. */
  monto: number;
  metodo?: PagoMetodo;
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
  ref?: { kind: "quote" | "booking" | "premium"; id: string };
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
 * Estado del hilo derivado del estado del pago (server-authoritative al
 * confirmar/rechazar; el cliente solo provoca metodo→comprobante).
 */
export function statusDePago(estado: PagoEstado): ConversationStatus {
  switch (estado) {
    case "en_revision":
      return "esperando_confirmacion";
    case "confirmado":
      return "cerrado";
    default:
      // metodo_pendiente | comprobante_pendiente | rechazado → el cliente sigue
      return "abierto";
  }
}
