/**
 * Entidad de dominio: mensaje del hilo de una solicitud (cotización o reserva).
 * Chat cliente↔estudio. Tipos puros; sin UI ni Firebase.
 */

export type MessageFrom = "cliente" | "estudio" | "sistema";
export type MessageTipo = "mensaje" | "propuesta" | "comprobante";

export interface ThreadMessage {
  id: string;
  from: MessageFrom;
  tipo: MessageTipo;
  texto?: string;
  /** Adjunto (comprobante, archivo) subido a Storage. */
  attachmentUrl?: string;
  attachmentName?: string;
  /** Monto propuesto en COP (cuando `tipo === "propuesta"`). */
  price?: number;
  createdAt: number;
}

export type NewThreadMessage = Omit<ThreadMessage, "id" | "createdAt">;
