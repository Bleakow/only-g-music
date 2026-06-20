/** Etiquetas y colores de estado para cotizaciones y reservas (UI). */
import type { QuoteStatus } from "@/domain/quote";
import type { ReservaEstado, SesionEstado } from "@/domain/booking";

export const QUOTE_LABEL: Record<QuoteStatus, string> = {
  pendiente: "Pendiente",
  cotizada: "Cotizada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};

export const RESERVA_LABEL: Record<ReservaEstado, string> = {
  pendiente_pago: "Pendiente de pago",
  pago_en_revision: "Pago en revisión",
  confirmada: "Confirmada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
  expirada: "Expirada",
};

export const SESION_LABEL: Record<SesionEstado, string> = {
  programada: "Programada",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export function badgeClass(estado: string): string {
  switch (estado) {
    case "pendiente":
    case "pendiente_pago":
      return "border-amber-400/40 bg-amber-400/10 text-amber-200";
    case "cotizada":
    case "pago_en_revision":
      return "border-sky-400/40 bg-sky-400/10 text-sky-200";
    case "aceptada":
    case "confirmada":
    case "en_curso":
    case "completada":
      return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
    case "rechazada":
    case "cancelada":
    case "expirada":
      return "border-red-500/40 bg-red-500/10 text-red-200";
    default:
      return "border-white/20 bg-white/5 text-silver-200";
  }
}

export function fechaCorta(ms: number): string {
  return new Date(ms).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
