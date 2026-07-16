/**
 * Entidad de dominio: SOLICITUD DE CONVENIO. Un usuario pide asociarse como
 * PRODUCTOR o BEATMAKER (ofrecer servicios/beats a cambio del tráfico de la
 * web). Mientras la solicitud está `pendiente` el usuario sigue siendo visitante
 * (rol `cliente`); al APROBARLA, una Cloud Function server-authoritative le
 * otorga el rol correspondiente (los roles nunca se escriben desde el cliente).
 * Tipos puros y portables — no importar UI ni Firebase aquí.
 */

/** Tipos de convenio disponibles hoy. `cantante` NO usa convenio: es self-serve. */
export type ConvenioTipo = "productor" | "beatmaker";

export type ConvenioEstado = "pendiente" | "aprobada" | "rechazada";

export const CONVENIO_TIPOS: ConvenioTipo[] = ["productor", "beatmaker"];

export interface ConvenioRequest {
  id: string;
  /** UID del solicitante (dueño de la solicitud). */
  uid: string;
  displayName: string | null;
  email: string | null;
  tipo: ConvenioTipo;
  estado: ConvenioEstado;
  /** Nota del solicitante (experiencia, portafolio, enlaces). */
  mensaje?: string;
  createdAt: number;
  /** epoch ms en que el admin la aprobó/rechazó. */
  resueltoAt?: number;
  /** Motivo del rechazo (si aplica). */
  motivo?: string;
}

/** Datos para CREAR una solicitud (sin id/estado/timestamps: los pone el server). */
export type NuevaConvenioRequest = Pick<
  ConvenioRequest,
  "uid" | "displayName" | "email" | "tipo" | "mensaje"
>;

/** ¿La solicitud sigue abierta (esperando decisión del admin)? */
export function convenioPendiente(
  req: Pick<ConvenioRequest, "estado"> | null | undefined,
): boolean {
  return !!req && req.estado === "pendiente";
}
