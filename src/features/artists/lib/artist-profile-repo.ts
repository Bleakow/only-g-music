/**
 * Repositorio (data-access) de perfiles de artista en Firestore:
 * `artistProfiles/{slug}` (+ subcolección `likes/{uid}`). Único punto de acceso
 * a estos datos — la UI nunca toca Firestore directo.
 *
 * Privacidad: este documento es PÚBLICO (lectura abierta para QR/compartir/SEO).
 * El nombre real y la fecha de nacimiento NO viven aquí; son privados en
 * users/{uid}. El cliente solo edita su contenido; puntos/premium los maneja
 * admin/Functions (lo garantizan las reglas).
 *
 * Likes: derivados del tamaño de la subcolección (un doc por usuario), no de un
 * contador denormalizado — así no hay número que un cliente pueda inflar.
 */
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  type ArtistProfile,
  type EditableProfile,
  type Premium,
  perfilVisible,
} from "@/domain/artist-profile";

const COLLECTION = "artistProfiles";

/** Firestore rechaza `undefined`: lo quitamos antes de escribir. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

/** Mapea un documento de Firestore al modelo de dominio. */
function toProfile(slug: string, data: DocumentData): ArtistProfile {
  return {
    slug,
    uid: data.uid ?? "",
    artisticName: data.artisticName ?? "",
    tagline: data.tagline ?? "",
    genre: data.genre ?? "",
    city: data.city ?? undefined,
    bio: data.bio ?? "",
    accent: data.accent ?? "#8b5cf6",
    photoURL: data.photoURL ?? "",
    gallery: (data.gallery as string[]) ?? [],
    tracks: (data.tracks as ArtistProfile["tracks"]) ?? [],
    entryTrackUrl: data.entryTrackUrl ?? undefined,
    socials: (data.socials as ArtistProfile["socials"]) ?? {},
    trajectoryStartYear: data.trajectoryStartYear ?? new Date().getFullYear(),
    puntos: data.puntos ?? 0,
    premium: (data.premium as Premium | null) ?? null,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
  };
}

/** Lee un perfil por slug. Devuelve null si no existe. */
export async function getProfileBySlug(
  slug: string,
): Promise<ArtistProfile | null> {
  const snap = await getDoc(doc(db, COLLECTION, slug));
  return snap.exists() ? toProfile(slug, snap.data()) : null;
}

/** Todos los perfiles (para el panel admin). */
export async function getAllProfiles(): Promise<ArtistProfile[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => toProfile(d.id, d.data()));
}

/**
 * Perfiles visibles en la vitrina = premium VIGENTE. Filtra la expiración en
 * memoria (puro) para no necesitar índice compuesto; a escala se mueve a una
 * query indexada / Cloud Function que oculte los vencidos.
 */
export async function getVisibleProfiles(): Promise<ArtistProfile[]> {
  const now = Date.now();
  const all = await getAllProfiles();
  return all.filter((p) => perfilVisible(p, now));
}

/**
 * Crea un perfil. `uid`/`slug` fijan al dueño; `puntos` arranca en 0 y `premium`
 * lo activa admin al confirmar el pago (null hasta entonces). El admin puede
 * pasar un `premium` ya activo.
 */
export async function createProfile(
  uid: string,
  slug: string,
  data: EditableProfile,
  premium: Premium | null = null,
): Promise<void> {
  await setDoc(doc(db, COLLECTION, slug), {
    ...stripUndefined(data),
    uid,
    puntos: 0,
    premium,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Actualiza el contenido editable del perfil (no toca puntos/premium/uid). */
export async function updateProfile(
  slug: string,
  data: Partial<EditableProfile>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, slug), {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Activa/renueva el premium del perfil. SOLO admin (las reglas bloquean al
 * cliente sobre `premium`). El `premium` viene de `activarPremium(now)` (dominio).
 */
export async function setPremium(
  slug: string,
  premium: Premium,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, slug), {
    premium,
    updatedAt: serverTimestamp(),
  });
}

/** ¿Este usuario ya dio like a este perfil? */
export async function hasLiked(slug: string, uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, COLLECTION, slug, "likes", uid));
  return snap.exists();
}

/** Nº de likes (tamaño de la subcolección — sin contador que inflar). */
export async function countLikes(slug: string): Promise<number> {
  const snap = await getCountFromServer(
    collection(db, COLLECTION, slug, "likes"),
  );
  return snap.data().count;
}

/**
 * Da o quita like (toggle). Un doc por usuario en la subcolección. Devuelve el
 * nuevo estado (`true` = ahora le gusta).
 */
export async function toggleLike(slug: string, uid: string): Promise<boolean> {
  const ref = doc(db, COLLECTION, slug, "likes", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteDoc(ref);
    return false;
  }
  await setDoc(ref, { createdAt: serverTimestamp() });
  return true;
}
