/**
 * Data-access de las ARTES del usuario (§ "Perfiles y convenios").
 *
 * Pasa por Cloud Function y no por Firestore directo porque las reglas cierran
 * `users.roles` y `artistProfiles.disciplines` al cliente: de esas dos cosas
 * cuelgan la exención de membresía y en qué pestaña del directorio sales, así
 * que quién puede tocarlas lo decide el servidor. Ver `actualizarMisArtes`.
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { Role } from "@only-g/shared-types/user";

const actualizarMisArtesFn = httpsCallable<
  { artes: Role[] },
  { ok: boolean; disciplines: Role[] }
>(functions, "actualizarMisArtes");

/**
 * Fija las artes AUTOSERVICIO del usuario (la lista COMPLETA, no un delta) y
 * devuelve las disciplinas resultantes del perfil — que pueden incluir artes de
 * convenio que el usuario ya tenía y esta llamada no toca.
 *
 * La Function rechaza cualquier arte que exija convenio, así que la UI no es la
 * que guarda la regla: solo evita el viaje.
 */
export async function actualizarMisArtes(artes: Role[]): Promise<Role[]> {
  const { data } = await actualizarMisArtesFn({ artes });
  return data.disciplines;
}
