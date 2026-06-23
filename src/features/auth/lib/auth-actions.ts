/**
 * Acciones de autenticación (cliente). Envuelven el SDK de Firebase Auth y
 * garantizan que exista el documento de cuenta (`ensureUserAccount`) tras cada
 * alta/login, para que la app siempre tenga roles disponibles.
 */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  updateProfile,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureUserAccount } from "./user-repo";

/**
 * Crea/lee el perfil en Firestore SIN romper el login si falla (p. ej. reglas
 * de Firestore sin desplegar, o base aún no habilitada). La sesión de Auth ya
 * es válida; el perfil y los roles se sincronizan después (AuthProvider lo
 * reintenta en cada cambio de sesión).
 */
async function safeEnsureAccount(user: User) {
  try {
    await ensureUserAccount(user);
  } catch (e) {
    console.warn(
      "Auth OK, pero no se pudo crear/leer el perfil en Firestore " +
        "(¿reglas sin desplegar o Firestore sin habilitar?).",
      e,
    );
  }
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() });
  }
  await safeEnsureAccount(cred.user);
  // Verificación de email (no bloquea el alta si falla el envío).
  sendEmailVerification(cred.user).catch(() => {});
  return cred.user;
}

/** Envía el correo de restablecimiento de contraseña. */
export function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}

/** Reenvía el correo de verificación al usuario en sesión. */
export function resendEmailVerification() {
  return auth.currentUser
    ? sendEmailVerification(auth.currentUser)
    : Promise.resolve();
}

export async function loginWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await safeEnsureAccount(cred.user);
  return cred.user;
}

const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  await safeEnsureAccount(cred.user);
  return cred.user;
}

const facebookProvider = new FacebookAuthProvider();

export async function loginWithFacebook() {
  const cred = await signInWithPopup(auth, facebookProvider);
  await safeEnsureAccount(cred.user);
  return cred.user;
}

export function logout() {
  return firebaseSignOut(auth);
}

/** Clave semántica de error de auth (se traduce con el catálogo `authErrors`). */
export type AuthErrorCode =
  | "invalidEmail"
  | "emailInUse"
  | "weakPassword"
  | "wrongCredentials"
  | "popupClosed"
  | "accountExists"
  | "popupBlocked"
  | "notAllowed"
  | "tooManyRequests"
  | "missingEmail"
  | "unknown";

/** Mapea el código de Firebase Auth a una clave estable (i18n en la UI). */
export function authErrorCode(error: unknown): AuthErrorCode {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-email":
      return "invalidEmail";
    case "auth/email-already-in-use":
      return "emailInUse";
    case "auth/weak-password":
      return "weakPassword";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "wrongCredentials";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "popupClosed";
    case "auth/account-exists-with-different-credential":
      return "accountExists";
    case "auth/popup-blocked":
      return "popupBlocked";
    case "auth/operation-not-allowed":
      return "notAllowed";
    case "auth/too-many-requests":
      return "tooManyRequests";
    case "auth/missing-email":
      return "missingEmail";
    default:
      return "unknown";
  }
}
