/**
 * Pedido de Perfil de Artista. Reusa el flujo de pago de `bookings` (comprobante
 * + confirmación del admin) mediante una Reserva `tipo: 'perfil_artista'` sin
 * slot ni fecha. Lógica PURA: sin UI ni Firebase.
 */
import type { NewReserva } from "./booking";
import type { SedeId } from "./sede";

/** Precio del perfil de artista (2 meses) en COP. Ajustable por negocio. */
export const PRECIO_PERFIL = 80000;

export const PERFIL_SERVICE_SLUG = "perfil-artista";
export const PERFIL_SERVICE_NAME = "Perfil de Artista (2 meses)";
/** Sede nominal del pedido (no es una cita, pero `sede` es obligatorio en Reserva). */
export const PERFIL_SEDE: SedeId = "barranquilla";

/**
 * Construye el pedido de perfil (Reserva `perfil_artista`). `start = now` (no es
 * una cita: sirve para agrupar el ingreso por mes en finanzas), sin slot. El
 * `precio` es opcional y por defecto la constante: el componente pasa el valor
 * vigente de `usePrecios()` para que el monto mostrado == el que se cobrará. El
 * server es autoritativo (onBookingCreatedAmountGuard corrige contra el config).
 */
export function nuevoPedidoPerfil(params: {
  uid: string;
  now: number;
  artistSlug: string;
  clientName?: string;
  clientEmail?: string;
  precio?: number;
}): NewReserva {
  return {
    uid: params.uid,
    serviceSlug: PERFIL_SERVICE_SLUG,
    serviceName: PERFIL_SERVICE_NAME,
    sede: PERFIL_SEDE,
    start: params.now,
    durationMin: 0,
    amount: params.precio ?? PRECIO_PERFIL,
    clientName: params.clientName,
    clientEmail: params.clientEmail,
    tipo: "perfil_artista",
    artistSlug: params.artistSlug,
  };
}
