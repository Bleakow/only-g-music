// @only-g/shared-types — tipos y constantes de dominio (puros, 0 deps de runtime).
//
// Convención: importar por SUBPATH, igual que el antiguo `@/domain/*`.
//   import { hasAnyRole } from "@only-g/shared-types/user";
//   import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
//
// No se expone un barrel plano (`export *`) a propósito: hay nombres que
// colisionan entre módulos (p. ej. `compararOrden` en artist-profile y
// profile-order). Los subpaths evitan la ambigüedad y mantienen el idiom.
export {};
