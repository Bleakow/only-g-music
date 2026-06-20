/**
 * Entidad de dominio: Solicitud de cotización. Tipos puros y portables.
 * No importar UI ni Firebase aquí.
 */

import type { SedeId } from "./sede";

export type QuoteStatus = "pendiente" | "cotizada" | "aceptada" | "rechazada";

/** Una línea del pedido: un servicio (o su variante) con su cantidad. */
export interface QuoteItem {
  serviceSlug: string;
  serviceName: string;
  /** Variante elegida (p. ej. "Por horas", "Agrupación"), si aplica. */
  variantId?: string;
  /** Cantidad (canciones / horas / unidades). */
  quantity: number;
  /** Precio unitario en COP al momento (referencia). Ausente si "a cotizar". */
  unitPrice?: number;
}

/** Artista invitado al proyecto (debe ser un artista del roster/registrado). */
export interface QuoteCollaborator {
  /** Identificador del artista (slug hoy; uid de usuario en el futuro). */
  id: string;
  name: string;
  image?: string;
}

/** Archivo adjunto subido a Storage. */
export interface QuoteAttachment {
  url: string;
  name: string;
}

export interface QuoteRequest {
  id: string;
  /** Usuario que solicita (dueño). */
  uid: string;
  /** Ítems del pedido (uno o varios servicios con cantidad). */
  items: QuoteItem[];
  /** Artistas invitados (opcional). */
  collaborators?: QuoteCollaborator[];
  /** Descripción libre del proyecto. */
  details: string;
  /** Links de referencia / ejemplos (opcional). */
  references?: string;
  /** Archivos adjuntos (instrumentales, ejemplos…) subidos a Storage. */
  attachments?: QuoteAttachment[];
  sede: SedeId;
  /** Presupuesto aproximado, texto libre (opcional). */
  budget?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  /** Suma estimada de los ítems con precio fijo (COP). */
  estimatedTotal?: number;
  /** true si algún ítem es "a cotizar" (sin precio cerrado). */
  hasQuoteOnlyItems?: boolean;
  status: QuoteStatus;
  /** epoch ms. */
  createdAt: number;
}

/** Datos que aporta el cliente al crear la solicitud (sin id/estado/fecha). */
export type NewQuoteRequest = Omit<QuoteRequest, "id" | "status" | "createdAt">;

// ── Máquina de estados de la cotización (parte del spine del negocio) ──
// Transiciones PURAS, compartidas por cliente y servidor. El estudio cotiza;
// el cliente acepta/rechaza. `aceptada` → genera una Reserva (Track Operativo).
const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  pendiente: ["cotizada", "rechazada"],
  cotizada: ["aceptada", "rechazada"],
  aceptada: [],
  rechazada: [],
};

export function nextQuoteStates(estado: QuoteStatus): QuoteStatus[] {
  return QUOTE_TRANSITIONS[estado];
}

export function canQuoteTransition(
  from: QuoteStatus,
  to: QuoteStatus,
): boolean {
  return QUOTE_TRANSITIONS[from].includes(to);
}
