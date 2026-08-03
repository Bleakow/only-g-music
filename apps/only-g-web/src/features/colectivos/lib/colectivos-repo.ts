import {
  type DocumentData,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type {
  Colectivo,
  ColectivoMiembro,
  EditableColectivo,
} from "@only-g/shared-types/colectivo";
import { DEFAULT_ACCENT } from "@only-g/shared-types/colectivo";
import { db } from "@/lib/firebase";

const COLLECTION = "colectivos";

/**
 * Acceso a Firestore para COLECTIVOS (§07).
 *
 * Mismo patrón que `artist-profile-repo`: el documento se lee con una WHITELIST
 * explícita (`toColectivo`) en vez de volcar `data()` tal cual. Cuesta una línea
 * por campo, pero evita que un campo interno se cuele al cliente — y obliga a
 * recordar la regla que ya nos mordió una vez: **si añades un campo al tipo y no
 * lo mapeas aquí, "no existe" al leer**.
 */
function toColectivo(id: string, data: DocumentData): Colectivo {
  return {
    slug: id,
    nombre: data.nombre ?? "",
    tipo: data.tipo ?? "sello",
    disciplina: data.disciplina ?? "musica",
    ownerUid: data.ownerUid ?? "",
    adminUids: (data.adminUids as string[]) ?? undefined,
    descripcion: data.descripcion ?? undefined,
    ciudad: data.ciudad ?? undefined,
    location: data.location ?? undefined,
    accent: data.accent ?? DEFAULT_ACCENT,
    logoURL: data.logoURL ?? undefined,
    coverURL: data.coverURL ?? undefined,
    miembros: (data.miembros as ColectivoMiembro[]) ?? [],
    stats: data.stats ?? undefined,
    lanzamientos: data.lanzamientos ?? undefined,
    generos: (data.generos as string[]) ?? undefined,
    socials: data.socials ?? undefined,
    visible: data.visible ?? undefined,
    orden: typeof data.orden === "number" ? data.orden : undefined,
    createdAt: data.createdAt?.toMillis?.() ?? undefined,
    updatedAt: data.updatedAt?.toMillis?.() ?? undefined,
  };
}

/** Un colectivo por su slug. `null` si no existe. */
export async function getColectivoBySlug(
  slug: string,
): Promise<Colectivo | null> {
  const snap = await getDoc(doc(db, COLLECTION, slug));
  if (!snap.exists()) return null;
  return toColectivo(snap.id, snap.data());
}

/**
 * Los colectivos de la vitrina. El filtrado fino (tipo, disciplina, texto) se
 * hace en cliente con `filtrarColectivos`: el directorio es pequeño y así los
 * filtros responden al instante, sin una consulta por cada clic.
 */
export async function listColectivos(max = 100): Promise<Colectivo[]> {
  const q = query(collection(db, COLLECTION), limit(max));
  const snap = await getDocs(q);
  return (
    snap.docs
      .map((d) => toColectivo(d.id, d.data()))
      // El filtro de visibilidad va en CLIENTE a propósito. En Firestore,
      // `where("visible", "!=", false)` descarta los documentos donde el campo
      // NO EXISTE — un colectivo creado a mano en consola desaparecería de la
      // vitrina sin que nadie entienda por qué. Aquí, "sin campo" = visible.
      .filter((c) => c.visible !== false)
  );
}

/** Los colectivos a los que pertenece un artista (por su slug de perfil). */
export async function listColectivosDeArtista(
  artistSlug: string,
): Promise<Colectivo[]> {
  // `miembros` es un array de objetos, que Firestore no sabe consultar por un
  // campo interno. Se mantiene `miembroSlugs` (array plano de strings) como
  // índice de consulta, escrito junto a `miembros`.
  const q = query(
    collection(db, COLLECTION),
    where("miembroSlugs", "array-contains", artistSlug),
    limit(20),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toColectivo(d.id, d.data()));
}

/** Crea un colectivo. El creador queda como dueño. */
export async function createColectivo(
  slug: string,
  ownerUid: string,
  data: EditableColectivo,
): Promise<void> {
  await setDoc(doc(db, COLLECTION, slug), {
    ...data,
    ownerUid,
    miembroSlugs: (data.miembros ?? []).map((m) => m.slug),
    visible: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Actualiza un colectivo (solo dueño/co-admin: lo blindan las reglas). */
export async function updateColectivo(
  slug: string,
  data: Partial<EditableColectivo>,
): Promise<void> {
  const patch: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  // El índice plano se recalcula SIEMPRE que cambian los miembros, o las
  // consultas "colectivos de este artista" se quedarían desactualizadas.
  if (data.miembros) {
    patch.miembroSlugs = data.miembros.map((m) => m.slug);
  }
  await updateDoc(doc(db, COLLECTION, slug), patch);
}

/** Slug a partir del nombre: "Caribe 2.0" → "caribe-2-0". */
export function slugify(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** ¿Está libre este slug? */
export async function slugDisponible(slug: string): Promise<boolean> {
  const snap = await getDoc(doc(db, COLLECTION, slug));
  return !snap.exists();
}

/** Colectivos ordenados para la vitrina (curaduría primero). */
export async function listColectivosOrdenados(): Promise<Colectivo[]> {
  try {
    const q = query(collection(db, COLLECTION), orderBy("orden"), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => toColectivo(d.id, d.data()));
  } catch {
    // Sin índice o sin `orden` en los documentos: cae a la lista simple, que
    // el cliente ordena igual con `filtrarColectivos`.
    return listColectivos();
  }
}
