/**
 * Registro de push (FCM) de ESTE dispositivo. Pide permiso, registra el service
 * worker, obtiene el token y lo guarda en `users/{uid}/fcmTokens/{token}` para que
 * las Functions puedan enviarle el push. Best-effort: nunca lanza, degrada a false.
 *
 * El service worker recibe la config de Firebase por query params (todo público
 * `NEXT_PUBLIC_*`) porque corre fuera del bundler y no ve `process.env`.
 */
import { getToken } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getMessagingIfSupported } from "@/lib/firebase/messaging";

const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

const SW_CONFIG: Record<string, string> = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/** ¿El navegador soporta push y está configurada la VAPID? */
export function pushDisponible(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    !!VAPID
  );
}

/** Permiso actual de notificaciones (o null si no aplica). */
export function permisoPush(): NotificationPermission | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  return Notification.permission;
}

async function registrarSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const qs = new URLSearchParams(SW_CONFIG).toString();
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs}`);
}

/**
 * Activa el push para el usuario en este dispositivo. Pide permiso si hace falta.
 * Si ya estaba concedido, solo refresca el token (rotación). Devuelve true si quedó
 * registrado.
 */
export async function activarPush(uid: string): Promise<boolean> {
  try {
    if (!pushDisponible() || !VAPID) return false;
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return false;
    const messaging = await getMessagingIfSupported();
    const swReg = await registrarSW();
    if (!messaging || !swReg) return false;
    const token = await getToken(messaging, {
      vapidKey: VAPID,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return false;
    await setDoc(doc(db, "users", uid, "fcmTokens", token), {
      createdAt: serverTimestamp(),
      ua: navigator.userAgent.slice(0, 200),
    });
    return true;
  } catch (e) {
    console.error("[push] activar:", e);
    return false;
  }
}
