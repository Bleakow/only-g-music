import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { PaseTipo, ValeId } from "@only-g/shared-types/pase";

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
  { targetUid: string; vale: ValeId },
  { ok: true }
>(functions, "marcarValeEntregado");

export async function marcarValeEntregado(
  targetUid: string,
  vale: ValeId,
): Promise<void> {
  await marcarValeFn({ targetUid, vale });
}

/**
 * El DUEÑO reclama un vale de su pase: el servidor abre (o reusa) el hilo con el
 * estudio, lo marca como reclamado y avisa al equipo. Devuelve el id del hilo
 * para llevar al usuario a la conversación. Idempotente.
 */
const reclamarValeFn = httpsCallable<
  { vale: ValeId },
  { conversationId: string }
>(functions, "reclamarVale");

export async function reclamarVale(vale: ValeId): Promise<string> {
  const res = await reclamarValeFn({ vale });
  return res.data.conversationId;
}
