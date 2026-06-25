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
  type PhotoTransform,
  type PlayerSize,
  type GalleryItem,
  type GallerySpan,
  GALLERY_SPAN_CYCLE,
  MAX_DESTACADOS,
  perfilVisible,
  compararOrden,
  toSlug,
} from "@/domain/artist-profile";

const COLLECTION = "artistProfiles";

/**
 * Normaliza la galería: acepta el formato nuevo (objetos {url, span}) y el viejo
 * (array de strings, que se mapea a tamaño cuadrado). Descarta entradas sin url.
 */
function toGallery(raw: unknown): GalleryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it): GalleryItem => {
      if (typeof it === "string") return { url: it, span: "sq" };
      const o = (it ?? {}) as Partial<GalleryItem>;
      const span = GALLERY_SPAN_CYCLE.includes(o.span as GallerySpan)
        ? (o.span as GallerySpan)
        : "sq";
      return { url: String(o.url ?? ""), span };
    })
    .filter((it) => it.url);
}

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
    photoTransform: (data.photoTransform as PhotoTransform) ?? undefined,
    gallery: toGallery(data.gallery),
    tracks: (data.tracks as ArtistProfile["tracks"]) ?? [],
    entryTrackUrl: data.entryTrackUrl ?? undefined,
    playerOverlay: data.playerOverlay ?? undefined,
    playerX: typeof data.playerX === "number" ? data.playerX : undefined,
    playerY: typeof data.playerY === "number" ? data.playerY : undefined,
    playerSize: (data.playerSize as PlayerSize) ?? undefined,
    socials: (data.socials as ArtistProfile["socials"]) ?? {},
    trajectoryStartYear: data.trajectoryStartYear ?? new Date().getFullYear(),
    orden: typeof data.orden === "number" ? data.orden : undefined,
    featured: data.featured ?? false,
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
 * Perfiles visibles en la vitrina = premium VIGENTE (pagar = publicar). Ordenados
 * por la curaduría del admin (`orden`). Filtra la expiración en memoria (puro)
 * para no necesitar índice compuesto; a escala se mueve a query indexada.
 */
export async function getVisibleProfiles(): Promise<ArtistProfile[]> {
  const now = Date.now();
  const all = await getAllProfiles();
  return all.filter((p) => perfilVisible(p, now)).sort(compararOrden);
}

/**
 * Artistas del menú "Destacados": visibles (premium) + `featured`, ordenados por
 * `orden` y recortados a MAX_DESTACADOS (red de seguridad si el admin marcó de más).
 */
export async function getFeaturedProfiles(): Promise<ArtistProfile[]> {
  const visible = await getVisibleProfiles();
  return visible.filter((p) => p.featured).slice(0, MAX_DESTACADOS);
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
 * Activa/renueva (o DESACTIVA con `null`) el premium del perfil. SOLO admin (las
 * reglas bloquean al cliente sobre `premium`). Para activar, `premium` viene de
 * `activarPremium(now)`; `null` lo deja como borrador (deja de ser visible).
 */
export async function setPremium(
  slug: string,
  premium: Premium | null,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, slug), {
    premium,
    updatedAt: serverTimestamp(),
  });
}

/** Borra un perfil (SOLO admin — las reglas lo blindan). Irreversible. */
export async function deleteProfile(slug: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, slug));
}

/** ¿Ya existe un perfil con este slug? */
export async function profileExists(slug: string): Promise<boolean> {
  return (await getDoc(doc(db, COLLECTION, slug))).exists();
}

/** Genera un slug único a partir de un nombre (añade -2, -3… si choca). */
export async function uniqueSlug(name: string): Promise<string> {
  const base = toSlug(name) || "perfil";
  let slug = base;
  let n = 2;
  while (await profileExists(slug)) slug = `${base}-${n++}`;
  return slug;
}

/**
 * Crea un "mock profile" (relleno de vitrina): un perfil SIN dueño (uid vacío) ni
 * vínculo a ningún usuario, que el admin rellena luego. Arranca como borrador
 * (sin premium). Devuelve el slug generado. SOLO admin (rules: isAdmin crea
 * cualquiera). El resto del contenido se edita en el builder en modo admin.
 */
export async function createMockProfile(artisticName: string): Promise<string> {
  const slug = await uniqueSlug(artisticName);
  await createProfile(
    "",
    slug,
    {
      artisticName: artisticName.trim() || "Nuevo perfil",
      tagline: "",
      genre: "",
      bio: "",
      accent: "#8b5cf6",
      photoURL: "",
      gallery: [],
      tracks: [],
      socials: {},
      trajectoryStartYear: new Date().getFullYear(),
    },
    null,
  );
  return slug;
}

/**
 * Curaduría de la vitrina (orden y/o destacado). SOLO admin — las reglas bloquean
 * estos campos al artista. `orden` menor aparece primero; `featured` lo pone en
 * el menú de destacados.
 */
export async function setCuracion(
  slug: string,
  patch: { orden?: number; featured?: boolean },
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, slug), {
    ...stripUndefined(patch),
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
