/**
 * Acceso (cliente) a las Cloud Functions de gestión de usuarios para el admin.
 * El cliente NO puede leer otros `users/{uid}` ni tocar sus roles (lo prohíben
 * las reglas), así que buscar usuarios y vincular un perfil + asignar el rol
 * 'artista' pasan por funciones server-authoritative (Admin SDK).
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { Role } from "@only-g/shared-types/user";
import type { SedeId } from "@only-g/shared-types/sede";
import type { PaseTipo, Vale, ValeProduccion } from "@only-g/shared-types/pase";
import { getAllSedes } from "@/features/sedes/lib/sedes-repo";

/** Pase del usuario tal y como lo proyecta el servidor para el panel. */
export interface AdminUserPase {
  tipo: PaseTipo | null;
  activo: boolean;
  /** Hasta cuándo va la parte temporal (epoch ms). Los vales NO caducan. */
  expiresAt: number | null;
  cortesia: boolean;
  produccion: ValeProduccion | null;
  video: Vale | null;
}

/** Proyección mínima de un usuario para el panel del admin. */
export interface AdminUserHit {
  uid: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
  /** Slug del perfil ya vinculado (si lo tiene). */
  artistSlug: string | null;
  /** Alta de la cuenta (epoch ms), o null si el documento no lo guardó. */
  createdAt: number | null;
  /** Pase vigente o caducado (null = nunca tuvo). */
  pase: AdminUserPase | null;
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

/** Una página de usuarios + por dónde seguir. */
export interface AdminUsersPage {
  users: AdminUserHit[];
  /** Cursor para la siguiente página (uid del último), o null si no hay más. */
  cursor: string | null;
  hasMore: boolean;
}

const listUsersFn = httpsCallable<
  { cursor: string | null; limit?: number },
  AdminUsersPage
>(functions, "adminListUsers");

/**
 * Página de usuarios para la lista con scroll infinito (SOLO admin). El orden lo
 * fija el servidor (por id de documento) para no dejarse a nadie fuera; ver
 * `adminListUsers` en functions.
 */
export async function adminListUsers(
  cursor: string | null,
): Promise<AdminUsersPage> {
  const res = await listUsersFn({ cursor });
  return res.data;
}

const deleteUserFn = httpsCallable<
  { targetUid: string },
  { ok: boolean; authBorrado: boolean; conversaciones: number }
>(functions, "adminDeleteUser");

/**
 * BORRA la cuenta entera (SOLO admin): Auth + su rastro en Firestore (perfil,
 * datos de pago, conversaciones). IRREVERSIBLE — la UI tiene que pedir
 * confirmación explícita antes de llamar aquí. Lanza `failed-precondition` si se
 * intenta contra uno mismo o contra una cuenta CEO.
 */
export async function adminDeleteUser(targetUid: string): Promise<void> {
  await deleteUserFn({ targetUid });
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

/** Un productor pagable: uid + nombre visible + su sede (si está asignado a una). */
export interface ProductorLite {
  uid: string;
  nombre: string;
  /** Id de la 1ª sede donde figura (para prefijar la sede en el payout), o null. */
  sedeId: SedeId | null;
  /** Nombre de esa sede (para mostrar), o null. */
  sedeNombre: string | null;
}

/**
 * Lista los PRODUCTORES pagables (SOLO admin) derivándolos de las SEDES: la fuente
 * canónica de quién es productor es `sede.productores` (uids), que `adminAssignProductor`
 * mantiene junto con el rol. Une esos uids con su nombre vía `adminGetUsersByIds`
 * (el cliente no puede leer otros `users/{uid}`). Si un uid figura en varias sedes,
 * se queda con la primera. Ordena por nombre. Nota: `adminGetUsersByIds` topa en 50
 * — más que suficiente para el nº de productores del sello.
 */
export async function listProductores(): Promise<ProductorLite[]> {
  const sedes = await getAllSedes();
  const sedeDeUid = new Map<string, { id: SedeId; nombre: string }>();
  for (const s of sedes) {
    for (const uid of s.productores) {
      if (!sedeDeUid.has(uid)) sedeDeUid.set(uid, { id: s.id, nombre: s.nombre });
    }
  }
  const uids = Array.from(sedeDeUid.keys());
  if (uids.length === 0) return [];

  const users = await adminGetUsersByIds(uids);
  return users
    .map((u) => {
      const sede = sedeDeUid.get(u.uid) ?? null;
      return {
        uid: u.uid,
        nombre: u.displayName || u.email || u.uid,
        sedeId: sede?.id ?? null,
        sedeNombre: sede?.nombre ?? null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
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
