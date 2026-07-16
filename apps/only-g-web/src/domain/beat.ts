/**
 * Entidad de dominio: BEAT (marketplace) y PETICIÓN de beat. Tipos puros y
 * portables — no importar UI ni Firebase aquí.
 *
 * Modelo comercial v1 (decisión de negocio): precio de catálogo ESTÁNDAR único
 * (todos los beats valen igual, sin tiers de licencia) y comisión FIJA de la
 * plataforma; el resto es del beatmaker, que cobra por transferencia MANUAL del
 * admin. El cobro reutiliza el flujo de pago existente (chat + comprobante).
 */

/** Precio de catálogo estándar por beat (COP). Ajustable por negocio. */
export const PRECIO_BEAT = 40000;

/** Comisión FIJA de la plataforma por venta de beat (0.2 = 20%). */
export const COMISION_BEAT = 0.2;

/** Reparto de una venta: cuánto se queda Only G (comisión) y cuánto el beatmaker. */
export function repartoBeat(precio: number = PRECIO_BEAT): {
  comision: number;
  beatmaker: number;
} {
  const comision = Math.round(precio * COMISION_BEAT);
  return { comision, beatmaker: precio - comision };
}

export interface Beat {
  id: string;
  /** UID del beatmaker dueño. */
  beatmakerUid: string;
  /** Slug del perfil del beatmaker (para enlazar desde la ficha del beat). */
  beatmakerSlug?: string;
  /** Nombre visible del beatmaker (denormalizado para el catálogo). */
  beatmakerNombre?: string;
  titulo: string;
  /** Género (de MUSIC_GENRES; string para no acoplar el dominio). */
  genero: string;
  /**
   * PREVIEW público del beat en Storage (lo que suena en el catálogo, con
   * marca de agua o recorte — decisión de UI/subida). URL pública.
   */
  audioUrl: string;
  /**
   * Ruta (NO url) del MÁSTER en Storage, bajo una carpeta PRIVADA
   * (`beats/masters/{uid}/...`): nadie lo descarga directo. Se entrega al
   * comprador mediante una URL FIRMADA generada por el servidor
   * (`confirmPayment`) tras confirmar el pago.
   */
  masterPath?: string;
  /** Portada opcional. */
  coverUrl?: string;
  bpm?: number;
  tags?: string[];
  /** Publicado y visible en el catálogo. */
  activo: boolean;
  createdAt: number;
}

export type BeatRequestEstado = "abierta" | "tomada" | "entregada" | "cerrada";

/**
 * Petición de beat a medida: el cliente sube un EJEMPLO/referencia y describe su
 * idea; la petición cae en una lista abierta y un beatmaker la TOMA para crearla.
 */
export interface BeatRequest {
  id: string;
  /** UID del cliente que pide. */
  uid: string;
  clientName: string | null;
  descripcion: string;
  genero?: string;
  /** Ejemplo/referencia subido por el cliente (Storage). */
  ejemploUrl?: string;
  estado: BeatRequestEstado;
  /** UID del beatmaker que tomó el trabajo (si alguno). */
  tomadaPor?: string;
  createdAt: number;
}

/** Datos para publicar un beat (sin id/estado/timestamps: los pone el repo). */
export type NuevoBeat = Pick<
  Beat,
  | "beatmakerUid"
  | "beatmakerSlug"
  | "beatmakerNombre"
  | "titulo"
  | "genero"
  | "audioUrl"
  | "masterPath"
  | "coverUrl"
  | "bpm"
  | "tags"
>;

/** Datos para crear una petición de beat. */
export type NuevaBeatRequest = Pick<
  BeatRequest,
  "uid" | "clientName" | "descripcion" | "genero" | "ejemploUrl"
>;
