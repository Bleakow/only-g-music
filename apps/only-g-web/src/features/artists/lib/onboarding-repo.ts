/**
 * Acceso (cliente) a la Cloud Function del alta de artista. Crear el perfil +
 * otorgar el rol `artista` es server-authoritative (el cliente no puede tocar
 * roles), así que va por función. La usa el alta para crear el perfil GRATIS como
 * BORRADOR (el cobro va al PUBLICAR, en el editor); si el usuario tiene un pase
 * activo, el perfil nace ya publicado.
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

const crearPerfilInicialFn = httpsCallable<
  {
    artisticName: string;
    realName: string;
    birthDate: string;
    startYear: number;
    photoURL: string;
  },
  { slug: string }
>(functions, "crearPerfilInicial");

/**
 * Crea el perfil de artista al registrarse (GRATIS, borrador). El SERVER otorga
 * el rol `artista`, fija el slug y —si hay pase activo— lo publica. Devuelve el slug.
 */
export async function crearPerfilInicial(data: {
  artisticName: string;
  realName: string;
  birthDate: string;
  startYear: number;
  photoURL: string;
}): Promise<string> {
  const res = await crearPerfilInicialFn(data);
  return res.data.slug;
}
