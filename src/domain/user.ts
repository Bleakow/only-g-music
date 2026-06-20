/**
 * Entidad de dominio: Cuenta de usuario. Tipos puros y portables (reutilizables
 * en una futura app nativa). No importar nada de UI ni de Firebase aquí.
 */

/**
 * Roles del sistema. Un usuario puede tener VARIOS a la vez (p. ej. el admin
 * también es productor). Regla de oro: comprobar "tiene el rol", nunca "es el rol".
 */
export type Role = "cliente" | "productor" | "admin" | "artista";

/** Rol por defecto al crear una cuenta nueva (se registra como cliente/fan). */
export const DEFAULT_ROLES: Role[] = ["cliente"];

export interface UserAccount {
  /** UID de Firebase Auth. */
  uid: string;
  email: string | null;
  /** Nombre visible. */
  displayName: string | null;
  /** Foto de perfil / avatar. */
  photoURL: string | null;
  /** Roles simultáneos del usuario. */
  roles: Role[];
  /** Fecha de creación (epoch ms). */
  createdAt: number;

  // ── Datos privados del artista (solo los ve/edita el dueño) ──────────
  /** Nombre y apellido reales (PRIVADO — nunca va al perfil público). */
  realName?: string;
  /** Fecha de nacimiento "YYYY-MM-DD" (PRIVADO). */
  birthDate?: string;
  /** Slug de su perfil público de artista (enlace con artistProfiles/{slug}). */
  artistSlug?: string;
  /** Borrador capturado en el onboarding; prellena el editor del perfil. */
  artistDraft?: ArtistDraft;
}

/** Datos del perfil capturados al registrarse como artista (prellenan el editor). */
export interface ArtistDraft {
  artisticName: string;
  trajectoryStartYear: number;
  photoURL: string;
}

/** ¿La cuenta tiene este rol? */
export function hasRole(
  account: Pick<UserAccount, "roles"> | null | undefined,
  role: Role,
): boolean {
  return !!account && account.roles.includes(role);
}

/** ¿La cuenta tiene AL MENOS uno de estos roles? */
export function hasAnyRole(
  account: Pick<UserAccount, "roles"> | null | undefined,
  roles: Role[],
): boolean {
  return !!account && account.roles.some((r) => roles.includes(r));
}
