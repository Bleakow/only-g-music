/**
 * Entidad de dominio: CONFIG COMERCIAL editable por el CEO. Tipos PUROS y
 * portables — no importar UI ni Firebase aquí.
 *
 * Los valores comerciales (comisiones % y precios COP) dejan de ser constantes
 * hardcodeadas: viven en Firestore, partidos en DOS documentos por visibilidad
 * de LECTURA (Firestore gatea lectura a nivel de doc):
 *   - `comercialConfig/comisiones`  → INTERNAS. read/write solo CEO.
 *   - `comercialConfig/precios`     → VISIBLES al comprador. read autenticado; write CEO.
 *
 * El SERVIDOR (Cloud Functions, dinero) y el CLIENTE (display) leen de aquí, con
 * FALLBACK a `DEFAULTS` (los valores históricos). Así el negocio ajusta comisión
 * o precio sin desplegar, y el comprador SIEMPRE ve lo que se le va a cobrar
 * (el server sigue siendo autoritativo: valida/clampa el monto al confirmar).
 */

/** Comisiones (fracciones 0..1) que se queda la plataforma. INTERNAS: solo CEO. */
export interface Comisiones {
  /** Comisión por venta de beat (0.2 = 20%). */
  comisionBeat: number;
  /**
   * Comisión del productor por reserva. AÚN SIN VALOR: el dueño la define
   * después (Fase 5). Ausente = "no configurada" (ningún cálculo la usa todavía).
   */
  comisionProductor?: number;
}

/** Precios de catálogo/suscripción en COP (enteros > 0). VISIBLES al comprador. */
export interface Precios {
  /** Precio de catálogo estándar por beat. */
  precioBeat: number;
  /** Precio de la membresía mensual (toggle admin). */
  precioMembresia: number;
  /** Precio del perfil de artista / premium (2 meses). */
  precioPerfil: number;
}

/** Config comercial completa (lo que ve el CEO: comisiones internas + precios). */
export interface ComercialConfig {
  comisiones: Comisiones;
  precios: Precios;
}

/**
 * Valores por DEFECTO = las constantes históricas del dominio. Son el FALLBACK
 * cuando el doc no existe o un campo es inválido. `comisionProductor` NO tiene
 * default (el dueño aún no lo definió): queda `undefined` a propósito.
 */
export const DEFAULTS: ComercialConfig = {
  comisiones: { comisionBeat: 0.2 },
  precios: { precioBeat: 40000, precioMembresia: 15000, precioPerfil: 80000 },
};

/** ¿Comisión válida? Fracción finita en [0, 1] (0%..100%). */
export function esComisionValida(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
}

/** ¿Precio válido? Entero > 0 (COP no usa centavos; un neto no puede ser 0/negativo). */
export function esPrecioValido(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/**
 * Normaliza un doc `comercialConfig/precios` crudo a `Precios`, CLAMPEANDO cada
 * campo: si es inválido, rige el default. Nunca lanza — el display no puede
 * romperse por un config malformado.
 */
export function parsePrecios(raw: Record<string, unknown> | undefined): Precios {
  const d = DEFAULTS.precios;
  return {
    precioBeat: esPrecioValido(raw?.precioBeat) ? raw!.precioBeat as number : d.precioBeat,
    precioMembresia: esPrecioValido(raw?.precioMembresia)
      ? (raw!.precioMembresia as number)
      : d.precioMembresia,
    precioPerfil: esPrecioValido(raw?.precioPerfil)
      ? (raw!.precioPerfil as number)
      : d.precioPerfil,
  };
}

/**
 * Normaliza un doc `comercialConfig/comisiones` crudo a `Comisiones`.
 * `comisionBeat` cae al default si es inválida; `comisionProductor` solo se
 * incluye si es válida (si no, queda ausente = "no configurada").
 */
export function parseComisiones(
  raw: Record<string, unknown> | undefined,
): Comisiones {
  const out: Comisiones = {
    comisionBeat: esComisionValida(raw?.comisionBeat)
      ? (raw!.comisionBeat as number)
      : DEFAULTS.comisiones.comisionBeat,
  };
  if (esComisionValida(raw?.comisionProductor)) {
    out.comisionProductor = raw!.comisionProductor as number;
  }
  return out;
}
