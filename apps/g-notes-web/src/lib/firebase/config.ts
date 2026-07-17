import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

/**
 * Cliente de Firebase de G Notes. Apunta al MISMO proyecto que Only G Music, así
 * que el `uid` y el documento `users/{uid}` son los mismos en ambas apps: una
 * cuenta, un usuario, los mismos datos.
 *
 * OJO — la SESIÓN no viaja entre las apps: la persistencia de Firebase Auth vive
 * en IndexedDB, que está aislada por ORIGEN. Only G y G Notes son dominios
 * distintos, así que el usuario inicia sesión aquí una vez aunque ya lo esté allá.
 * Misma cuenta, login separado.
 *
 * Estos valores son PÚBLICOS por diseño (viven en el navegador). La seguridad
 * real son las reglas de Firestore y la verificación del ID token en el servidor.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Evita reinicializar la app en hot-reload o múltiples imports.
const isNewApp = getApps().length === 0;
const app: FirebaseApp = isNewApp ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);

// Firestore para sincronizar la biblioteca del escritor por uid.
// `ignoreUndefinedProperties`: Firestore RECHAZA `undefined` y aborta la escritura
// completa; con esto esos campos se omiten en vez de reventar. `initializeFirestore`
// solo puede llamarse una vez por app (de ahí el guard `isNewApp`).
export const db: Firestore = isNewApp
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : getFirestore(app);

export default app;
