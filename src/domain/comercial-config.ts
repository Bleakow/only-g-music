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
   * Comisión GLOBAL del productor por reserva (0.2 = Only G se queda 20%, el
   * productor cobra el 80% neto). Ausente = "no configurada" → la Fase 5 no
   * dispara para las sedes que tampoco tengan override (sigue el pago manual).
   */
  comisionProductor?: number;
  /**
   * Override de la comisión de productor POR SEDE (`sedeId → fracción 0..1`). Si
   * una sede no está aquí, HEREDA `comisionProductor` (el global). Permite un
   * corte distinto en una sede puntual. Solo sobreviven al parseo las entradas
   * válidas [0,1]; ausente/{} = todas las sedes usan el global.
   */
  comisionProductorPorSede?: Record<string, number>;
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
export function parsePrecios(
  raw: Record<string, unknown> | undefined,
): Precios {
  const d = DEFAULTS.precios;
  return {
    precioBeat: esPrecioValido(raw?.precioBeat)
      ? (raw!.precioBeat as number)
      : d.precioBeat,
    precioMembresia: esPrecioValido(raw?.precioMembresia)
      ? (raw!.precioMembresia as number)
      : d.precioMembresia,
    precioPerfil: esPrecioValido(raw?.precioPerfil)
      ? (raw!.precioPerfil as number)
      : d.precioPerfil,
  };
}

/** Config de ANALÍTICA editable por el CEO: el ID de propiedad GA4 (para enlazar
 *  a los informes de Google Analytics). INTERNA: solo CEO. */
export interface AnaliticaConfig {
  /** ID numérico de la propiedad GA4 (p. ej. "123456789"), para el deep-link. */
  ga4PropertyId?: string;
}

/**
 * Property ID de GA4 de Only G por DEFECTO (propiedad `only-g-music-745ca`, la que
 * recibe los eventos de la app). Es el FALLBACK: el enlace a los informes funciona
 * sin configurar nada, y el CEO puede sobrescribirlo desde el panel si cambia. No
 * es secreto (es un id que igual se expone en el deep-link).
 */
export const DEFAULT_GA4_PROPERTY_ID = "541531599";

/** ¿ID de propiedad GA4 válido? Solo dígitos (GA4 usa un id numérico). */
export function esGa4PropertyId(v: unknown): v is string {
  return typeof v === "string" && /^[0-9]{4,20}$/.test(v.trim());
}

/**
 * Normaliza un doc `comercialConfig/analitica` crudo. Si el CEO configuró un id
 * válido, rige ese; si no (doc ausente o vacío), cae al `DEFAULT_GA4_PROPERTY_ID`
 * para que el enlace a GA4 funcione de fábrica.
 */
export function parseAnalitica(
  raw: Record<string, unknown> | undefined,
): AnaliticaConfig {
  const id = raw?.ga4PropertyId;
  return {
    ga4PropertyId: esGa4PropertyId(id)
      ? (id as string).trim()
      : DEFAULT_GA4_PROPERTY_ID,
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
  const porSedeRaw = raw?.comisionProductorPorSede;
  if (
    porSedeRaw &&
    typeof porSedeRaw === "object" &&
    !Array.isArray(porSedeRaw)
  ) {
    const porSede: Record<string, number> = {};
    for (const [sedeId, v] of Object.entries(
      porSedeRaw as Record<string, unknown>,
    )) {
      // Solo entradas válidas: una comisión malformada de una sede NO puede colarse
      // (última línea el clamp server-side; ver getComercial en functions).
      if (esComisionValida(v)) porSede[sedeId] = v;
    }
    if (Object.keys(porSede).length > 0) out.comisionProductorPorSede = porSede;
  }
  return out;
}
