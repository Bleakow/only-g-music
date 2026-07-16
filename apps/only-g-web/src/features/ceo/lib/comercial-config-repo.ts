/**
 * Repositorio (data-access) de la CONFIG COMERCIAL para el CEO. Lee/escribe los
 * dos docs de `comercialConfig` (comisiones internas + precios). SOLO el CEO
 * accede aquí: las reglas gatean `comercialConfig/comisiones` a isCeo() para
 * lectura y escritura, y la escritura de `comercialConfig/precios` a isCeo().
 *
 * Validación de DOMINIO en la escritura (primera línea de defensa; la segunda es
 * el CLAMP server-side en `getComercial`): comisión en [0,1], precio entero > 0.
 * La UI no toca Firestore directo — pasa por este repo. El display público lee
 * por su lado (`precios-repo`), sin acoplarse a esta superficie privilegiada.
 */
import { getDoc, setDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DEFAULTS,
  esComisionValida,
  esGa4PropertyId,
  esPrecioValido,
  parseAnalitica,
  parseComisiones,
  parsePrecios,
  type AnaliticaConfig,
  type ComercialConfig,
  type Comisiones,
  type Precios,
} from "@only-g/shared-types/comercial-config";

const COMISIONES_REF = () => doc(db, "comercialConfig", "comisiones");
const PRECIOS_REF = () => doc(db, "comercialConfig", "precios");
const ANALITICA_REF = () => doc(db, "comercialConfig", "analitica");

/**
 * Config completa para el panel CEO: comisiones (internas) + precios, cada una
 * normalizada con fallback a `DEFAULTS`. Requiere rol CEO (lo exigen las reglas
 * para leer `comercialConfig/comisiones`).
 */
export async function getComercialConfig(): Promise<ComercialConfig> {
  const [comSnap, preSnap] = await Promise.all([
    getDoc(COMISIONES_REF()),
    getDoc(PRECIOS_REF()),
  ]);
  return {
    comisiones: parseComisiones(comSnap.exists() ? comSnap.data() : undefined),
    precios: parsePrecios(preSnap.exists() ? preSnap.data() : undefined),
  };
}

/**
 * Actualiza las COMISIONES (SOLO CEO). Valida rango en cliente antes de escribir
 * (segunda línea: el CLAMP server-side en `getComercial`). El panel envía el estado
 * COMPLETO, así que se hace FULL-REPLACE del doc (sin `merge`): un campo/override
 * omitido = BORRADO. Es la única forma de que quitar el global o el override de una
 * sede realmente lo limpie (con `merge`, los mapas se fusionan y una clave eliminada
 * sobreviviría para siempre). El doc es de dominio exclusivo de este panel.
 */
export async function updateComisiones(data: Comisiones): Promise<void> {
  if (!esComisionValida(data.comisionBeat)) {
    throw new Error("comisionBeat fuera de rango [0,1].");
  }
  const payload: Record<string, unknown> = {
    comisionBeat: data.comisionBeat,
    updatedAt: serverTimestamp(),
  };
  if (data.comisionProductor !== undefined) {
    if (!esComisionValida(data.comisionProductor)) {
      throw new Error("comisionProductor fuera de rango [0,1].");
    }
    payload.comisionProductor = data.comisionProductor;
  }
  const porSede = data.comisionProductorPorSede;
  if (porSede && Object.keys(porSede).length > 0) {
    for (const [sedeId, v] of Object.entries(porSede)) {
      if (!esComisionValida(v)) {
        throw new Error(`comisión de la sede ${sedeId} fuera de rango [0,1].`);
      }
    }
    payload.comisionProductorPorSede = porSede;
  }
  await setDoc(COMISIONES_REF(), payload);
}

/** Actualiza los PRECIOS (SOLO CEO). Valida entero > 0 en cliente antes de escribir. */
export async function updatePrecios(data: Precios): Promise<void> {
  const campos: [keyof Precios, number][] = [
    ["precioBeat", data.precioBeat],
    ["precioMembresia", data.precioMembresia],
    ["precioPerfil", data.precioPerfil],
  ];
  for (const [nombre, valor] of campos) {
    if (!esPrecioValido(valor)) {
      throw new Error(`${nombre} debe ser un entero > 0.`);
    }
  }
  await setDoc(
    PRECIOS_REF(),
    {
      precioBeat: data.precioBeat,
      precioMembresia: data.precioMembresia,
      precioPerfil: data.precioPerfil,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** ID de propiedad GA4 configurado (o `{}` si no se ha puesto). SOLO CEO. */
export async function getAnalitica(): Promise<AnaliticaConfig> {
  const snap = await getDoc(ANALITICA_REF());
  return parseAnalitica(snap.exists() ? snap.data() : undefined);
}

/**
 * Guarda el ID de propiedad GA4 (SOLO CEO). Valida que sea numérico. Cadena vacía
 * = lo limpia (vuelve a enlazar a la home de GA4).
 */
export async function updateAnalitica(ga4PropertyId: string): Promise<void> {
  const id = ga4PropertyId.trim();
  if (id !== "" && !esGa4PropertyId(id)) {
    throw new Error("El ID de propiedad GA4 debe ser numérico.");
  }
  await setDoc(
    ANALITICA_REF(),
    { ga4PropertyId: id, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Re-exporta los defaults para que el panel muestre "valor actual o default". */
export { DEFAULTS };
