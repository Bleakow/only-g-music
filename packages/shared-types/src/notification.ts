/**
 * Catálogo de eventos de notificación (SEAM — Fase 4.3). Vocabulario PURO y
 * AGNÓSTICO de proveedor: define QUÉ se notifica y ADÓNDE lleva al hacer click,
 * nunca CÓMO se envía. La implementación concreta (Novu) vive detrás de la
 * interfaz `notify(evento, destinatario, payload)` y es sustituible sin tocar
 * este archivo ni a los llamadores. Si mañana cambia el proveedor, se reescribe
 * el adaptador, no el catálogo.
 *
 * Cada `NotifEvento` corresponde 1:1 a un workflow en el dashboard de Novu (mismo
 * identificador). Decisión de UX: la notificación NO lleva botones de acción; su
 * `redirect` lleva al panel donde se ve el contexto completo y se actúa (p. ej.
 * confirmar un pago recurrente se hace en /admin/gastos, no desde el aviso).
 */

/** Identificador de evento = identificador de workflow en Novu (kebab-case). */
export type NotifEvento =
  // Mensajería (chat de solicitudes / soporte / pago)
  | "mensaje-nuevo"
  // Pagos
  | "pago-por-revisar" // el cliente subió comprobante → revisa el admin
  | "pago-confirmado" // el admin confirmó → se avisa al cliente
  // Cotizaciones
  | "cotizacion-nueva" // nueva solicitud → admin
  | "cotizacion-respondida" // el estudio respondió → cliente
  // Citas / sesiones del productor
  | "sesion-agendada" // se asignó/creó una sesión → productor
  | "sesion-proxima" // recordatorio de sesión cercana → productor
  // Contabilidad
  | "gasto-recurrente-por-confirmar" // egreso recurrente vencido → admin
  // Perfiles de artista
  | "perfil-artista-creado" // alta de perfil → admin
  | "premium-activado" // membresía activada → artista
  | "perfil-por-renovar" // premium por vencer → artista
  // G Notes (escritor inteligente)
  | "gnotes-activado" // membresía G Notes activada → IA sin límite
  // Pases (paquetes)
  | "pase-activado" // pase activado (compra o cortesía) → beneficios concedidos
  // Convenios (productor/beatmaker)
  | "convenio-solicitado" // nueva solicitud → admin
  | "convenio-aprobado" // el admin aprobó → se avisa al solicitante
  | "convenio-rechazado" // el admin rechazó → se avisa al solicitante
  // Beats (marketplace)
  | "beat-vendido" // se confirmó la venta → avisa al beatmaker
  // Payouts (liquidación de cuentas por pagar)
  | "payout-pagado"; // el admin liquidó lo adeudado → avisa al socio acreedor

export const NOTIF_EVENTOS: NotifEvento[] = [
  "mensaje-nuevo",
  "pago-por-revisar",
  "pago-confirmado",
  "cotizacion-nueva",
  "cotizacion-respondida",
  "sesion-agendada",
  "sesion-proxima",
  "gasto-recurrente-por-confirmar",
  "perfil-artista-creado",
  "premium-activado",
  "perfil-por-renovar",
  "gnotes-activado",
  "pase-activado",
  "convenio-solicitado",
  "convenio-aprobado",
  "convenio-rechazado",
  "beat-vendido",
  "payout-pagado",
];

/**
 * Destinatario de una notificación. `subscriberId` es el subscriber de Novu, que
 * mapeamos 1:1 al `uid` del usuario (Firebase Auth). Email/nombre son opcionales
 * (Novu los usa para el canal email y para personalizar la plantilla).
 */
export interface Destinatario {
  subscriberId: string; // = user.uid
  email?: string;
  nombre?: string;
}

/** Datos que viajan con el evento: alimentan la plantilla y el deep link. */
export type NotifPayload = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface NotifEventoMeta {
  /** Ruta in-app a la que lleva el click (deep link). Base; el trigger puede
   *  concatenar un id concreto vía `rutaNotificacion`. */
  redirectBase: string;
  /** Descripción humana del evento (docs + dashboard). */
  descripcion: string;
}

/** Metadatos por evento: a qué panel lleva y qué significa. */
export const NOTIF_META: Record<NotifEvento, NotifEventoMeta> = {
  "mensaje-nuevo": {
    redirectBase: "/solicitudes",
    descripcion: "Nuevo mensaje en una conversación",
  },
  "pago-por-revisar": {
    redirectBase: "/admin",
    descripcion: "Comprobante de pago subido, pendiente de revisión",
  },
  "pago-confirmado": {
    redirectBase: "/solicitudes",
    descripcion: "El estudio confirmó tu pago",
  },
  "cotizacion-nueva": {
    redirectBase: "/admin",
    descripcion: "Nueva solicitud de cotización",
  },
  "cotizacion-respondida": {
    redirectBase: "/solicitudes",
    descripcion: "El estudio respondió tu cotización",
  },
  "sesion-agendada": {
    redirectBase: "/consola",
    descripcion: "Se te asignó una sesión",
  },
  "sesion-proxima": {
    redirectBase: "/consola",
    descripcion: "Tienes una sesión próxima",
  },
  "gasto-recurrente-por-confirmar": {
    redirectBase: "/admin/gastos",
    descripcion: "Egreso recurrente vencido: confirma si se pagó",
  },
  "perfil-artista-creado": {
    redirectBase: "/admin/perfiles",
    descripcion: "Se creó un nuevo perfil de artista",
  },
  "premium-activado": {
    redirectBase: "/artista/perfil",
    descripcion: "Tu membresía premium fue activada",
  },
  "perfil-por-renovar": {
    redirectBase: "/artista/perfil",
    descripcion: "Tu perfil premium está por vencer",
  },
  "gnotes-activado": {
    redirectBase: "/solicitudes",
    descripcion: "Tu membresía de G Notes fue activada (IA sin límite)",
  },
  "pase-activado": {
    redirectBase: "/suscripciones",
    descripcion: "Tu pase fue activado (beneficios concedidos)",
  },
  "convenio-solicitado": {
    redirectBase: "/admin/convenios",
    descripcion: "Nueva solicitud de convenio (productor/beatmaker)",
  },
  "convenio-aprobado": {
    redirectBase: "/artista/perfil",
    descripcion: "Tu solicitud de convenio fue aprobada",
  },
  "convenio-rechazado": {
    redirectBase: "/solicitudes",
    descripcion: "Tu solicitud de convenio fue rechazada",
  },
  "beat-vendido": {
    redirectBase: "/beats/publicar",
    descripcion: "Se vendió uno de tus beats",
  },
  "payout-pagado": {
    redirectBase: "/cuenta",
    descripcion: "Only G te liquidó lo que se te debía",
  },
};

/**
 * Deep link de la notificación. Devuelve `redirectBase` y, si el evento apunta a
 * un detalle y se pasa `refId` (+ `tipo` opcional: cotizacion|reserva), construye
 * la ruta concreta del hilo/solicitud. Mantiene en UN solo sitio el mapeo
 * evento→panel (la decisión de "lleva al panel, no botones en el aviso").
 */
export function rutaNotificacion(
  evento: NotifEvento,
  ref?: { id?: string; tipo?: "cotizacion" | "reserva" },
): string {
  const base = NOTIF_META[evento].redirectBase;
  if (!ref?.id) return base;
  // Eventos que abren el detalle de una solicitud (cliente) o del panel admin.
  if (base === "/solicitudes" && ref.tipo) {
    return `/solicitudes/${ref.tipo}/${ref.id}`;
  }
  if (base === "/admin" && ref.tipo) {
    return `/admin/${ref.tipo}/${ref.id}`;
  }
  return base;
}

/**
 * Una notificación entregada a un usuario (lo que pinta la campanita). El texto
 * NO se guarda resuelto: se guardan `evento` + `params`, y el cliente lo traduce
 * al idioma ACTUAL con next-intl (`notificaciones.eventos.<evento>.{titulo,cuerpo}`).
 * `ruta` es el deep link (sin prefijo de locale; lo añade el <Link> de next-intl).
 */
export interface Notificacion {
  id: string;
  evento: NotifEvento;
  /** Variables para la plantilla i18n (deben coincidir con las que pone el trigger). */
  params: NotifPayload;
  ruta: string;
  leido: boolean;
  archivado?: boolean;
  createdAt: number;
}
