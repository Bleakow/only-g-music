import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { PaseTipo } from "@only-g/shared-types/pase";

/**
 * Llama a la Cloud Function que ACTIVA un pase de cortesía (gratis) a un usuario.
 * SOLO admin (la Function lo verifica); concede todos los beneficios del pase sin
 * generar asiento contable.
 */
const activarPaseFn = httpsCallable<
  { targetUid: string; tipo: PaseTipo },
  { ok: true }
>(functions, "activarPaseCortesia");

export async function activarPaseCortesia(
  targetUid: string,
  tipo: PaseTipo,
): Promise<void> {
  await activarPaseFn({ targetUid, tipo });
}

/** Marca un vale (producción/video) del pase de un usuario como ENTREGADO. */
const marcarValeFn = httpsCallable<
  { targetUid: string; vale: "produccion" | "video" },
  { ok: true }
>(functions, "marcarValeEntregado");

export async function marcarValeEntregado(
  targetUid: string,
  vale: "produccion" | "video",
): Promise<void> {
  await marcarValeFn({ targetUid, vale });
}
