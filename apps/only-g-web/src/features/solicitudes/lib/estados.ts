/**
 * Colores de badge por estado y formato de fecha (UI).
 *
 * Las ETIQUETAS de estado viven ahora en el catálogo i18n (namespace `status`):
 * usa `t(`status.${estado}`)` en las vistas. Antes había aquí mapas
 * QUOTE_LABEL/RESERVA_LABEL/SESION_LABEL en español; se eliminaron en la fase 4.5b.
 */
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
    case "confirmado":
    case "en_curso":
    case "completada":
      return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
    case "rechazada":
    case "cancelada":
    case "cancelado":
    case "expirada":
      return "border-red-500/40 bg-red-500/10 text-red-200";
    default:
      return "border-white/20 bg-white/5 text-silver-200";
  }
}

export function fechaCorta(ms: number, locale: string): string {
  return new Date(ms).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
