import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

// Acciones de sesión de G Notes. Solo INICIAR sesión: la cuenta se crea en Only G
// Music (misma cuenta, mismo proyecto), así no duplicamos el alta ni sus reglas.

export async function loginWithGoogle(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

/** Traduce los códigos `auth/*` de Firebase a un mensaje corto y humano. */
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-email":
      return "Ese correo no tiene buena pinta.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera un momento.";
    case "auth/popup-closed-by-user":
      return "Cerraste la ventana antes de terminar.";
    case "auth/network-request-failed":
      return "Sin conexión. Revisa tu red.";
    default:
      return "No se pudo iniciar sesión. Inténtalo de nuevo.";
  }
}
