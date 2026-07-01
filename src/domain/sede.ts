/**
 * Entidad de dominio: Sede física de la productora. Tipos puros y portables.
 * No importar UI ni Firebase aquí.
 */
import type { DestinoPago } from "./payment-destination";

// NOTA: `SedeId` es un union fijo solo mientras las sedes son data estática.
// Al migrar a Firestore (módulo de Estudios) pasará a `string`.
export type SedeId = "barranquilla" | "bogota";

export interface Sede {
  id: SedeId;
  /** Nombre corto para botones/etiquetas ("Barranquilla"). */
  nombre: string;
  /** Ciudad + departamento ("Barranquilla, Atlántico"). */
  ciudad: string;
  direccion: string;
  /**
   * Destino de pago PROPIO de la sede (override). Si está, gana sobre el destino
   * por defecto de la compañía (ver `resolverDestinoPago`). Ausente = los pagos
   * de esta sede van al default centralizado.
   */
  pago?: DestinoPago;
  /** Horario de atención, texto para mostrar ("Lun–Sáb · 10:00–20:00"). */
  horario: string;
  /** Horas reservables del día (slots de agenda). */
  slots: string[];
  /** Productores asignados a la sede (1–2 ids; se llenará en fases de roles). */
  productores: string[];
}
