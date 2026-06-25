/**
 * Acceso (cliente) a las Cloud Functions de gestión de usuarios para el admin.
 * El cliente NO puede leer otros `users/{uid}` ni tocar sus roles (lo prohíben
 * las reglas), así que buscar usuarios y vincular un perfil + asignar el rol
 * 'artista' pasan por funciones server-authoritative (Admin SDK).
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

/** Proyección mínima de un usuario para el buscador del admin. */
export interface AdminUserHit {
  uid: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
  /** Slug del perfil ya vinculado (si lo tiene). */
  artistSlug: string | null;
}

const searchUsersFn = httpsCallable<
  { query: string },
  { users: AdminUserHit[] }
>(functions, "adminSearchUsers");

/** Busca usuarios por email/nombre (SOLO admin). */
export async function adminSearchUsers(query: string): Promise<AdminUserHit[]> {
  const res = await searchUsersFn({ query });
  return res.data.users;
}

const linkProfileFn = httpsCallable<
  { targetUid: string; artisticName: string },
  { slug: string }
>(functions, "adminLinkProfile");

/**
 * Crea un perfil vinculado al usuario `targetUid` y le asigna el rol 'artista'
 * (si no lo tenía). Devuelve el slug generado. Lanza `functions/already-exists`
 * si el usuario ya tiene un perfil.
 */
export async function adminLinkProfile(
  targetUid: string,
  artisticName: string,
): Promise<string> {
  const res = await linkProfileFn({ targetUid, artisticName });
  return res.data.slug;
}
