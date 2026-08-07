/**
 * Repositorio del BOOK (§10): `artistProfiles/{slug}/book/main`. Único punto de
 * acceso a estos datos — la UI nunca toca Firestore directo.
 *
 * ¿POR QUÉ UN DOCUMENTO APARTE Y NO UN CAMPO DEL PERFIL? Porque el documento del
 * perfil lo lee todo el mundo: cada tarjeta del directorio, cada visita, cada
 * consulta de la vitrina. Meter ahí veintiocho piezas con sus textos hace pagar
 * ese peso a todos por un portafolio que casi nadie abre. Y encima
 * `indexArtistProfile` es un `onDocumentWritten` sobre el perfil: editar el book
 * dispararía la Function de indexado a cada guardado.
 *
 * Lo que sí vive en el perfil es un ESPEJO de tres campos (`bookPublicado`,
 * `bookPortada`, `bookPiezas`), lo justo para pintar la tarjeta de entrada sin
 * una segunda lectura. Por eso `saveBook` escribe los dos documentos EN LOTE: si
 * el espejo pudiera fallar por su cuenta, el perfil acabaría anunciando un book
 * que ya no existe.
 *
 * Lectura PÚBLICA (como el perfil): el enlace del book se comparte con clientes,
 * que no tienen por qué tener cuenta.
 */
import { deleteField, doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  contarPiezas,
  normalizarBook,
  portadaDelBook,
  type Book,
} from "@only-g/shared-types/book";

const COLLECTION = "artistProfiles";
const SUBCOLLECTION = "book";
/** Un book por perfil: documento de id fijo, no una colección de versiones. */
const DOC_ID = "main";

function refBook(slug: string) {
  return doc(db, COLLECTION, slug, SUBCOLLECTION, DOC_ID);
}

/**
 * Firestore rechaza `undefined`, y el book lo lleva por todas partes (títulos,
 * notas, pósters, ratios). Un `stripUndefined` superficial no vale: hay que
 * limpiar dentro de escenas → piezas. Pasarlo por JSON quita esas claves de
 * cuajo y es seguro aquí porque un `Book` es JSON plano — sin fechas, sin Map,
 * sin clases.
 */
function aJsonPlano(book: Book): Record<string, unknown> {
  return JSON.parse(JSON.stringify(book)) as Record<string, unknown>;
}

/**
 * Lee el book de un perfil. `null` = todavía no ha creado ninguno (distinto de
 * "lo creó y está vacío": el editor necesita saber cuál de las dos cosas es).
 */
export async function getBook(slug: string): Promise<Book | null> {
  const snap = await getDoc(refBook(slug));
  if (!snap.exists()) return null;
  // Se normaliza SIEMPRE al leer: el documento puede venir de una versión
  // anterior del catálogo de escenas, o traer una escena que ya no existe.
  return normalizarBook(snap.data());
}

/**
 * Guarda el book y actualiza el espejo del perfil en la misma operación.
 *
 * Se normaliza antes de escribir para que lo guardado ya cumpla las invariantes
 * (portada primera, cierre último, textos recortados, y despublicado si se quedó
 * sin contenido). Devuelve el book tal y como quedó, que puede no ser
 * exactamente el que se pasó — el llamador debe adoptarlo como su estado.
 */
export async function saveBook(slug: string, book: Book): Promise<Book> {
  const limpio = normalizarBook(book);
  const portada = portadaDelBook(limpio);

  const batch = writeBatch(db);
  batch.set(refBook(slug), aJsonPlano(limpio));
  batch.update(doc(db, COLLECTION, slug), {
    bookPublicado: limpio.publicado,
    bookPiezas: contarPiezas(limpio),
    // `deleteField` y no `undefined`: si quitó la foto de portada, el campo tiene
    // que DESAPARECER. Omitirlo dejaría la miniatura vieja anunciando una foto
    // que ya no está en el book.
    bookPortada: portada ?? deleteField(),
  });
  await batch.commit();

  return limpio;
}
