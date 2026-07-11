/**
 * Acceso (cliente) a las Cloud Functions de gestión de usuarios para el admin.
 * El cliente NO puede leer otros `users/{uid}` ni tocar sus roles (lo prohíben
 * las reglas), así que buscar usuarios y vincular un perfil + asignar el rol
 * 'artista' pasan por funciones server-authoritative (Admin SDK).
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { Role } from "@/domain/user";

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

const assignProductorFn = httpsCallable<
  { targetUid: string; sedeId: string },
  { ok: boolean }
>(functions, "adminAssignProductor");

/** Da el rol 'productor' a un usuario y lo registra en la sede (SOLO admin). */
export async function adminAssignProductor(
  targetUid: string,
  sedeId: string,
): Promise<void> {
  await assignProductorFn({ targetUid, sedeId });
}

const getUsersByIdsFn = httpsCallable<
  { uids: string[] },
  { users: AdminUserHit[] }
>(functions, "adminGetUsersByIds");

/** Proyección de usuarios por UID (para mostrar los productores asignados). */
export async function adminGetUsersByIds(
  uids: string[],
): Promise<AdminUserHit[]> {
  const res = await getUsersByIdsFn({ uids });
  return res.data.users;
}

const setRolesFn = httpsCallable<
  { uid: string; roles: Role[] },
  { ok: boolean; roles: Role[] }
>(functions, "adminSetRoles");

/**
 * Fija los roles de un usuario (SOLO admin). Sincroniza `disciplines`/`socio`
 * del perfil vinculado (si existe) server-side. Lanza `functions/failed-precondition`
 * si el admin intenta quitarse su propio rol admin.
 */
export async function adminSetRoles(
  uid: string,
  roles: Role[],
): Promise<{ ok: boolean; roles: Role[] }> {
  const res = await setRolesFn({ uid, roles });
  return res.data;
}

const activarMembresiaFn = httpsCallable<
  { slug: string; cortesia: boolean },
  { ok: boolean }
>(functions, "activarMembresia");

/**
 * Activa la membresía mensual de un perfil (SOLO admin). Si `cortesia` es
 * true, la regala sin generar asiento contable; si no, factura `PRECIO_MEMBRESIA`.
 */
export async function activarMembresia(
  slug: string,
  cortesia: boolean,
): Promise<void> {
  await activarMembresiaFn({ slug, cortesia });
}
