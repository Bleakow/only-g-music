import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Verificación de sesión SERVER-SIDE. Es la puerta que protege los endpoints de
 * IA de Only G: sin un ID token válido de NUESTRO proyecto, no se llama a Gemini
 * (así un desconocido no puede quemar la cuota).
 *
 * No hace falta clave privada: `verifyIdToken` valida la firma del JWT contra las
 * claves públicas de Google y comprueba que el token fue emitido para este
 * `projectId`. Basta con inicializar con el projectId — funciona igual en local
 * que en Cloud Run / App Hosting (donde además existe la credencial por defecto).
 */
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const app: App =
  getApps().length === 0 ? initializeApp({ projectId }) : getApps()[0];

const adminAuth = getAuth(app);

/**
 * Firestore con el Admin SDK (SOLO server-side). Lo usa la búsqueda IA para leer
 * las fichas privadas de los perfiles (`searchIndex`) sin exponerlas al cliente.
 * En Cloud Run / App Hosting toma la credencial por defecto (ADC); en local
 * requeriría ADC o el emulador. La instancia es perezosa a nivel de query: crearla
 * aquí no falla aunque no haya credencial hasta que se consulta.
 */
export const adminDb = getFirestore(app);

/**
 * Extrae el ID token del header `Authorization: Bearer <token>` y lo verifica.
 * Devuelve el `uid` del usuario, o null si no hay sesión válida (→ responder 401).
 */
export async function verifiedUid(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    // Token caducado, manipulado o de otro proyecto.
    return null;
  }
}
