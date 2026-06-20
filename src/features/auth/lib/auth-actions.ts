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

/** Traduce los códigos de error de Firebase Auth a mensajes en español. */
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-email":
      return "El correo no es válido.";
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con ese correo.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Cerraste la ventana de acceso antes de terminar.";
    case "auth/account-exists-with-different-credential":
      return "Ya existe una cuenta con ese correo usando otro método de acceso.";
    case "auth/popup-blocked":
      return "El navegador bloqueó la ventana emergente. Habilítala e inténtalo de nuevo.";
    case "auth/operation-not-allowed":
      return "Este método de acceso no está habilitado en Firebase.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Inténtalo de nuevo en un momento.";
    case "auth/missing-email":
      return "Escribe tu correo.";
    default:
      return "Algo salió mal. Inténtalo de nuevo.";
  }
}
