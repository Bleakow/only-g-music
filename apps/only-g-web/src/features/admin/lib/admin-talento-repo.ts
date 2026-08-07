/**
 * Data-access del TALENTO de un perfil visto por el admin: qué artes tiene y,
 * si cuelga de una cuenta, qué comisiones se pactaron con esa persona.
 *
 * Pasa por Cloud Functions y no por Firestore directo por dos razones distintas:
 *  · Las artes viven en `users/{uid}.roles` cuando el perfil está VINCULADO, y
 *    el cliente no puede leer ni escribir el `users` de otro (las reglas lo
 *    cierran al dueño). El perfil solo las refleja.
 *  · Las comisiones son un dato privado de esa persona: ni se leen ni se
 *    escriben desde el navegador.
 *
 * OJO con la puerta de al lado: `actualizarMisArtes` (features/artists) hace lo
 * mismo pero SOBRE QUIEN LLAMA. Desde el panel de admin hay que usar ESTAS, o el
 * admin acaba poniéndose a sí mismo el arte que quería dar a otro.
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { Role } from "@only-g/shared-types/user";

/** Comisiones pactadas, ya normalizadas: `null` = sin pactar (rige la global). */
export interface ComisionesPactadas {
  beat: number | null;
  produccion: number | null;
}

/** Foto completa del talento de un perfil para el panel del admin. */
export interface PerfilTalento {
  /** ¿Cuelga de una cuenta de usuario? `false` = perfil mock. */
  vinculado: boolean;
  uid: string | null;
  displayName: string | null;
  email: string | null;
  /** Artes activas (roles de talento de la cuenta, o del perfil si es mock). */
  artes: Role[];
  /**
   * ¿Tiene el rol `productor`? No es un arte —es función comercial, atada a una
   * sede— pero decide si procede pactarle comisión de producción: el reparto la
   * exige, así que sin el rol el pacto no lo lee nadie.
   */
  esProductor: boolean;
  comisiones: ComisionesPactadas;
  /** Lo que rige HOY si no se pacta nada, para poder enseñarlo de referencia. */
  globales: { beat: number; produccion: number | null };
}

const getFn = httpsCallable<{ slug: string }, PerfilTalento>(
  functions,
  "adminGetPerfilTalento",
);

/** Lee las artes y las comisiones de un perfil (SOLO admin). */
export async function adminGetPerfilTalento(
  slug: string,
): Promise<PerfilTalento> {
  const { data } = await getFn({ slug });
  return data;
}

const setFn = httpsCallable<
  {
    slug: string;
    artes: Role[];
    comisionBeat: number | null;
    comisionProduccion: number | null;
  },
  { ok: boolean; vinculado: boolean; disciplines: Role[]; socio: boolean }
>(functions, "adminSetPerfilTalento");

/**
 * Fija las artes de un perfil y —solo si está vinculado— las comisiones
 * pactadas. Las comisiones van en FRACCIÓN (0..1), no en porcentaje;
 * `null` borra el pacto y devuelve ese concepto a la comisión global.
 *
 * Devuelve las disciplinas resultantes para que la UI no tenga que adivinarlas:
 * en un perfil vinculado el servidor conserva los roles que no son artes, así
 * que lo guardado no siempre es literalmente lo enviado.
 */
export async function adminSetPerfilTalento(input: {
  slug: string;
  artes: Role[];
  comisionBeat: number | null;
  comisionProduccion: number | null;
}): Promise<{ disciplines: Role[]; socio: boolean }> {
  const { data } = await setFn(input);
  return { disciplines: data.disciplines, socio: data.socio };
}
