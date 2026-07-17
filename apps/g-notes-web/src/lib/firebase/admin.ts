import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Verificación de sesión SERVER-SIDE. Es la puerta que protege los endpoints de
 * IA: sin un ID token válido de NUESTRO proyecto, no se llama a Gemini.
 *
 * No hace falta ninguna clave privada: `verifyIdToken` valida la firma del JWT
 * contra las claves públicas de Google y comprueba que el token fue emitido para
 * este `projectId`. Por eso basta con inicializar con el projectId — funciona
 * igual en local que en Cloud Run (donde además existe la credencial por defecto).
 */
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const app: App =
  getApps().length === 0 ? initializeApp({ projectId }) : getApps()[0];

const adminAuth = getAuth(app);

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

/**
 * Hand-off SSO desde Only G: verifica un ID token y devuelve un CUSTOM token para
 * el mismo uid, con el que G Notes inicia sesión sin re-login. Firmar el custom
 * token requiere que el service account de Cloud Run tenga
 * `roles/iam.serviceAccountTokenCreator` sobre sí mismo. Si no lo tiene o el token
 * es inválido, devuelve null → el hand-off degrada a login normal.
 */
export async function mintCustomToken(idToken: string): Promise<string | null> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return await adminAuth.createCustomToken(decoded.uid);
  } catch {
    return null;
  }
}
