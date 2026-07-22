/**
 * Repositorio (data-access) de cuentas de usuario en Firestore: `users/{uid}`.
 * Único punto de acceso a los datos de cuenta — la UI nunca toca Firestore directo.
 */
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import {
  type UserAccount,
  type Role,
  type ArtistDraft,
  DEFAULT_ROLES,
} from "@only-g/shared-types/user";

const COLLECTION = "users";

/** Mapea un documento de Firestore al modelo de dominio. */
function toAccount(uid: string, data: DocumentData): UserAccount {
  return {
    uid,
    email: data.email ?? null,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    roles: (data.roles as Role[]) ?? DEFAULT_ROLES,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    realName: data.realName ?? undefined,
    birthDate: data.birthDate ?? undefined,
    artistSlug: data.artistSlug ?? undefined,
    artistDraft: (data.artistDraft as ArtistDraft) ?? undefined,
    gnotesPremium: data.gnotesPremium ?? undefined,
    pase: data.pase ?? undefined,
  };
}

/**
 * Guarda los datos privados del artista en su propio documento (el alta como
 * artista). NO toca `roles` (los cambia admin/Functions); las reglas exigen que
 * `roles` quede igual, así que este update pasa. El `artistDraft` prellena el
 * editor del perfil tras confirmarse el pago.
 */
export async function updateArtistPrivateData(
  uid: string,
  data: {
    realName: string;
    birthDate: string;
    artistSlug: string;
    artistDraft: ArtistDraft;
  },
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), { ...data });
}

/**
 * Vincula el slug del perfil público al usuario (`users/{uid}.artistSlug`). Alta
 * self-serve del BEATMAKER: a diferencia de `updateArtistPrivateData`, NO exige
 * nombre real ni fecha de nacimiento (datos propios del cantante). NO toca
 * `roles`, así que las reglas (que exigen `roles` inmutable) dejan pasar el
 * update. DEBE commitearse ANTES de crear el perfil: la regla `create` de
 * `artistProfiles` valida `get(users/{uid}).artistSlug == slug`.
 */
export async function setArtistSlug(uid: string, slug: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), { artistSlug: slug });
}

/**
 * Actualiza los campos editables de la cuenta (nombre y foto). NO toca `roles`
 * (las reglas exigen que queden igual que el doc actual), así que el update pasa.
 */
export async function updateUserProfile(
  uid: string,
  data: { displayName: string; photoURL: string },
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), {
    displayName: data.displayName,
    photoURL: data.photoURL,
  });
}

/** Lee la cuenta de un usuario. Devuelve null si no existe el documento. */
export async function getUserAccount(uid: string): Promise<UserAccount | null> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  return snap.exists() ? toAccount(uid, snap.data()) : null;
}

/**
 * Suscripción EN VIVO al doc de cuenta (`users/{uid}`). Refleja al instante los
 * cambios que hace el servidor (nuevo rol, membresía, etc.) sin que el usuario
 * tenga que recargar la pestaña. Devuelve la función para cancelar.
 */
export function subscribeUserAccount(
  uid: string,
  cb: (account: UserAccount | null) => void,
): () => void {
  return onSnapshot(
    doc(db, COLLECTION, uid),
    (snap) => cb(snap.exists() ? toAccount(uid, snap.data()) : null),
    (err) => {
      // Sin red / reglas: no rompemos la app; conservamos la cuenta actual.
      console.warn("[user-repo] subscribeUserAccount:", err);
    },
  );
}

/**
 * Devuelve la cuenta del usuario; si no existe, la crea con el rol por defecto.
 * Idempotente — seguro de llamar en cada login. NOTA: NO toca `roles` si la
 * cuenta ya existe (los roles solo los cambia admin/Cloud Functions, nunca aquí).
 */
export async function ensureUserAccount(user: User): Promise<UserAccount> {
  const ref = doc(db, COLLECTION, user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return toAccount(user.uid, snap.data());
  }

  await setDoc(ref, {
    // `?? null`: Firestore rechaza `undefined`; los campos de Auth pueden venir
    // sin definir según el proveedor.
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    roles: DEFAULT_ROLES,
    createdAt: serverTimestamp(),
  });

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    roles: DEFAULT_ROLES,
    createdAt: Date.now(),
  };
}
