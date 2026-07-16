/**
 * Repositorio (data-access) de PRECIOS visibles al comprador. Lee el doc
 * `comercialConfig/precios` (legible por cualquier autenticado — ver
 * firestore.rules) y lo normaliza al dominio con FALLBACK a `DEFAULTS`. La UI no
 * toca Firestore directo; consume `usePrecios()` (PreciosProvider), que llama
 * aquí. La ESCRITURA de precios vive en el repo del CEO (comercial-config-repo).
 *
 * Nota: la lectura exige sesión (regla `read: request.auth != null`). Un usuario
 * anónimo (p. ej. mirando el catálogo público) recibe permiso denegado → cae al
 * default. Es aceptable: para COMPRAR hay que iniciar sesión, y ahí ya lee el
 * precio real; el server es autoritativo del monto en todo caso.
 */
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { parsePrecios, type Precios } from "@only-g/shared-types/comercial-config";

/** Lee los precios vigentes; ante cualquier fallo/ausencia, devuelve los defaults. */
export async function getPrecios(): Promise<Precios> {
  const snap = await getDoc(doc(db, "comercialConfig", "precios"));
  return parsePrecios(snap.exists() ? snap.data() : undefined);
}
