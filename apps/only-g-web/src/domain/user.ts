/**
 * Entidad de dominio: Cuenta de usuario. Tipos puros y portables (reutilizables
 * en una futura app nativa). No importar nada de UI ni de Firebase aquí.
 */

/**
 * Roles del sistema. Un usuario puede tener VARIOS a la vez (p. ej. el admin
 * también es productor). Regla de oro: comprobar "tiene el rol", nunca "es el rol".
 */
export type Role =
  | "cliente"
  | "productor"
  | "admin"
  | "ceo"
  | "artista"
  | "beatmaker"
  | "modelo"
  | "bailarin";

/** Rol por defecto al crear una cuenta nueva (se registra como cliente/fan). */
export const DEFAULT_ROLES: Role[] = ["cliente"];

/**
 * Disciplinas de talento que viven en la "lista de artistas" del panel, cada una
 * con su propia pestaña. `artista` es, históricamente, la disciplina CANTANTE
 * (fue el primer rol). `productor` NO va aquí: se gestiona aparte, atado a sedes
 * y convenios comerciales. Al añadir más disciplinas (p. ej. `modelo`), basta
 * con listarlas aquí para que aparezca su pestaña.
 */
export const TALENT_ROLES: Role[] = [
  "artista",
  "beatmaker",
  "modelo",
  "bailarin",
];

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

/**
 * ¿La cuenta es CEO? El rol `ceo` es la super-cuenta del negocio: hereda TODOS
 * los permisos de admin y, además, ve/edita la config comercial (comisiones y
 * precios). INVARIANTE de seguridad: `ceo` NO se otorga desde el cliente ni
 * desde el panel de admin (`adminSetRoles` lo excluye de su whitelist) — solo se
 * asigna directamente en consola/Admin SDK. Por convención un CEO se aprovisiona
 * con AMBOS roles `['admin','ceo']` (así hereda todos los gates de admin del
 * cliente sin tocarlos); `esCeo` gatea únicamente la superficie exclusiva de CEO.
 */
export function esCeo(
  account: Pick<UserAccount, "roles"> | null | undefined,
): boolean {
  return hasRole(account, "ceo");
}
