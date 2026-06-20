/**
 * Entidad de dominio: Sede física de la productora. Tipos puros y portables.
 * No importar UI ni Firebase aquí.
 */

export type SedeId = "barranquilla" | "bogota";

export interface Sede {
  id: SedeId;
  /** Nombre corto para botones/etiquetas ("Barranquilla"). */
  nombre: string;
  /** Ciudad + departamento ("Barranquilla, Atlántico"). */
  ciudad: string;
  direccion: string;
  /** QR de pago de la sede (se usa en el flujo de pago manual, Fase 11). */
  qrPagoUrl?: string;
  /** Horario de atención, texto para mostrar ("Lun–Sáb · 10:00–20:00"). */
  horario: string;
  /** Horas reservables del día (slots de agenda). */
  slots: string[];
  /** Productores asignados a la sede (ids; se llenará en fases de roles). */
  productores: string[];
}
