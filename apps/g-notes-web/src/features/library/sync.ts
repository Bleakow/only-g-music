import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Library, Song } from "@/features/library/types";

// Sincronización de la biblioteca con Firestore. Un documento por usuario:
// `gnotes/{uid}` con la biblioteca entera. Client-side: el navegador escribe
// directo y las reglas de seguridad hacen de guardia (dueño = uid). Simple y
// barato (Firestore cobra por escritura de DOC, no por byte). Techo: 1 MB/doc
// (cientos de canciones); si algún día se acerca, se migra a subcolección por
// canción — de ahí el diseño local-first, que no depende de la nube para escribir.

const COLLECTION = "gnotes";

export async function loadCloudLibrary(uid: string): Promise<Library | null> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<Library>;
  return {
    songs: data.songs ?? [],
    releases: data.releases ?? [],
    lists: data.lists ?? [],
    activeId: data.activeId ?? null,
  };
}

export async function saveCloudLibrary(
  uid: string,
  lib: Library,
): Promise<void> {
  await setDoc(doc(db, COLLECTION, uid), {
    songs: lib.songs,
    releases: lib.releases,
    lists: lib.lists,
    activeId: lib.activeId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Une la biblioteca local con la de la nube SIN perder trabajo de ninguna:
 * - canciones: last-write-wins por `updatedAt` (id = clave), ordenadas por
 *   reciente (la más trabajada arriba);
 * - releases/listas: unión por id (no tienen `updatedAt`);
 * - activeId: el de la nube si su canción sigue existiendo, si no el local.
 * Protege el caso de dos dispositivos con trabajo offline distinto.
 */
export function mergeLibraries(local: Library, cloud: Library): Library {
  const songs = mergeSongs(local.songs, cloud.songs);
  const releases = unionById(cloud.releases, local.releases);
  const lists = unionById(cloud.lists, local.lists);

  const has = (id: string | null) => !!id && songs.some((s) => s.id === id);
  const activeId = has(cloud.activeId)
    ? cloud.activeId
    : has(local.activeId)
      ? local.activeId
      : (songs[0]?.id ?? null);

  return { songs, releases, lists, activeId };
}

function mergeSongs(a: Song[], b: Song[]): Song[] {
  const byId = new Map<string, Song>();
  for (const s of [...a, ...b]) {
    const prev = byId.get(s.id);
    // `>=`: en empate gana el iterado después (b = nube), da igual el contenido.
    if (!prev || (s.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) byId.set(s.id, s);
  }
  return [...byId.values()].sort(
    (x, y) => (y.updatedAt ?? 0) - (x.updatedAt ?? 0),
  );
}

function unionById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
  for (const x of [...a, ...b]) if (!byId.has(x.id)) byId.set(x.id, x);
  return [...byId.values()];
}
