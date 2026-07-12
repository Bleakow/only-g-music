/**
 * Entidad de dominio: Datos de pago del SOCIO — a DÓNDE le paga Only G (banco /
 * Nequi / efectivo). Tipos puros + un helper de completitud. Sin UI, sin
 * Firebase, sin i18n.
 *
 * OJO: esto es la dirección INVERSA de `DestinoPago` (payment-destination.ts).
 * Allí el cliente paga A la empresa; aquí la empresa paga AL socio. Son dominios
 * distintos y NO deben mezclarse. Doc dedicado `datosPago/{uid}` (privado): el
 * dueño escribe los suyos, el admin los lee para poder pagar (ver firestore.rules).
 */

/** Cómo cobra el socio. */
export type MetodoPagoSocio = "banco" | "nequi" | "efectivo";

/** Tipo de cuenta bancaria. */
export type TipoCuenta = "ahorros" | "corriente";

/** Tipo de documento del titular (Colombia). */
export type TipoDoc = "CC" | "CE" | "NIT" | "PAS";

/** Orden de presentación de los métodos en la UI. */
export const METODOS_PAGO_SOCIO: MetodoPagoSocio[] = [
  "banco",
  "nequi",
  "efectivo",
];

/** Tipos de cuenta, en orden de presentación. */
export const TIPOS_CUENTA: TipoCuenta[] = ["ahorros", "corriente"];

/** Tipos de documento, en orden de presentación. */
export const TIPOS_DOC: TipoDoc[] = ["CC", "CE", "NIT", "PAS"];

export interface DatosBanco {
  /** Entidad bancaria (Bancolombia, Davivienda…). */
  entidad: string;
  tipoCuenta: TipoCuenta;
  /** Número de cuenta (PRIVADO — nunca loguear). */
  numeroCuenta: string;
  /** Nombre del titular de la cuenta. */
  titular: string;
  tipoDoc: TipoDoc;
  /** Número de documento del titular. */
  numeroDoc: string;
}

export interface DatosNequi {
  /** Número de Nequi (teléfono). */
  telefono: string;
  /** Nombre del titular. */
  titular: string;
}

export interface DatosEfectivo {
  /** Nota libre opcional (cómo prefiere coordinar el efectivo). */
  nota?: string;
}

export interface DatosPagoSocio {
  metodo: MetodoPagoSocio;
  /** Presente solo si `metodo === 'banco'`. */
  banco?: DatosBanco;
  /** Presente solo si `metodo === 'nequi'`. */
  nequi?: DatosNequi;
  /** Presente solo si `metodo === 'efectivo'`. */
  efectivo?: DatosEfectivo;
  /** Última actualización (epoch ms). Lo pone el servidor. */
  updatedAt: number;
}

/** Payload de escritura: como `DatosPagoSocio` pero sin el sello del servidor. */
export type NuevoDatosPago = Omit<DatosPagoSocio, "updatedAt">;

/**
 * ¿Están completos los datos para el método elegido? (para recordatorios/UI).
 * Banco: todos sus campos no vacíos. Nequi: teléfono + titular. Efectivo:
 * siempre completo (la nota es opcional). `null` → false. Puro.
 */
export function datosPagoCompletos(d: DatosPagoSocio | null): boolean {
  if (!d) return false;
  switch (d.metodo) {
    case "banco": {
      const b = d.banco;
      return (
        !!b &&
        b.entidad.trim() !== "" &&
        b.numeroCuenta.trim() !== "" &&
        b.titular.trim() !== "" &&
        b.numeroDoc.trim() !== ""
      );
    }
    case "nequi": {
      const n = d.nequi;
      return !!n && n.telefono.trim() !== "" && n.titular.trim() !== "";
    }
    case "efectivo":
      return true;
    default:
      return false;
  }
}
