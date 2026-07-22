/**
 * Catálogo de eventos de EMBUDO (analytics). Nombres en snake_case (convención
 * GA4). PURO: solo el vocabulario; el envío vive en `lib/firebase/analytics.ts`
 * (Firebase Analytics, nativo). Tipado para que el embudo no se llene de strings
 * sueltos y sea consistente entre llamadores.
 */
export type AnalyticsEvent =
  // Captación
  | "cta_cotizar_clicked" // clic en "Cotizar con [artista]"
  // Cotización
  | "quote_started" // abre el wizard de cotización
  | "quote_submitted" // envía la solicitud
  // Reserva
  | "booking_started" // entra al calendario de reserva
  | "booking_created" // confirma una reserva (pendiente_pago)
  // Pedido (compra directa de servicios de precio fijo)
  | "pedido_submitted" // crea un pedido (pendiente_pago)
  // Pago
  | "payment_proof_uploaded" // sube comprobante
  | "premium_pay_started" // inicia el pago de membresía
  // Artista
  | "artist_signup_started" // entra a "soy artista"
  | "artist_profile_submitted" // crea/paga el perfil
  | "artist_profile_created_with_pass" // crea el perfil GRATIS con un pase activo
  // Beatmaker
  | "beatmaker_profile_created"; // alta self-serve del perfil de beatmaker (sin pago)

export const ANALYTICS_EVENTS: AnalyticsEvent[] = [
  "cta_cotizar_clicked",
  "quote_started",
  "quote_submitted",
  "booking_started",
  "booking_created",
  "pedido_submitted",
  "payment_proof_uploaded",
  "premium_pay_started",
  "artist_signup_started",
  "artist_profile_submitted",
  "artist_profile_created_with_pass",
  "beatmaker_profile_created",
];
