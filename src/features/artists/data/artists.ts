import type { Artist } from "@/domain/artist";

/**
 * Roster RETIRADO. Los artistas ahora viven en Firestore (`artistProfiles`),
 * curados por el admin; ya no hay placeholders. Esta semilla queda VACÍA a
 * propósito — la UI carga los perfiles reales en cliente (la vitrina, el menú,
 * el home y el buscador de colaboradores). Se mantiene el export para no romper
 * los imports del repo `artists-repo`.
 */
export const artists: Artist[] = [];
