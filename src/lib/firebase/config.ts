import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";

/**
 * Configuración del cliente de Firebase.
 * Estos valores son PÚBLICOS por diseño (viven en el navegador). La seguridad
 * real se define en las reglas de Firestore/Storage, no aquí.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Evita reinicializar la app en hot-reload o múltiples imports.
const isNewApp = getApps().length === 0;
const app: FirebaseApp = isNewApp ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);
// `ignoreUndefinedProperties`: Firestore RECHAZA `undefined` y revienta la
// escritura completa (incluso por un undefined anidado en un array de objetos,
// p. ej. un tema sin uno de sus links). Con esto, esos campos se omiten en vez
// de fallar. `initializeFirestore` solo puede llamarse una vez por app (de ahí
// el guard `isNewApp`; en hot-reload reusamos la instancia ya creada).
export const db: Firestore = isNewApp
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
// Cloud Functions callables. Misma región que los triggers (junto a la base).
export const functions: Functions = getFunctions(app, "southamerica-east1");

export default app;
