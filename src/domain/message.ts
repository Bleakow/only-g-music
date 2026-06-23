/**
 * Entidad de dominio: mensaje del hilo de una solicitud (cotización o reserva).
 * Chat cliente↔estudio. Tipos puros; sin UI ni Firebase.
 */

export type MessageFrom = "cliente" | "estudio" | "sistema";
export type MessageTipo = "mensaje" | "propuesta" | "comprobante" | "estado";

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
  /**
   * Código de estado (cuando `tipo === "estado"`). Se persiste el código, no el
   * texto, para que el chat lo traduzca al idioma de quien lo lee.
   */
  estado?: string;
  createdAt: number;
}

export type NewThreadMessage = Omit<ThreadMessage, "id" | "createdAt">;
