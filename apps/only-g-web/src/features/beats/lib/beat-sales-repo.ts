/**
 * Repositorio (data-access) de VENTAS de beats: colección `beatSales`. Separado
 * de `beats-repo.ts` (que es el catálogo/CRUD del beat) por cohesión: este
 * archivo cubre el flujo de compra y el payout del beatmaker. La UI no toca
 * Firestore/Functions directo. Sigue el mismo patrón que `conversations-repo`
 * (toBeatSale mapper, stripUndefined, serverTimestamp, httpsCallable para lo
 * server-authoritative).
 */
import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import type { Beat } from "@only-g/shared-types/beat";
import type { BeatSale } from "@only-g/shared-types/beat-sale";
import type { MetodoPago } from "@only-g/shared-types/payment-method";
import { createPaymentConversation } from "@/features/conversations/lib/conversations-repo";

const COLLECTION = "beatSales";

/** Mapea un documento de Firestore al modelo de dominio. */
function toBeatSale(id: string, data: DocumentData): BeatSale {
  return {
    id,
    beatId: data.beatId ?? "",
    beatTitulo: data.beatTitulo ?? "",
    beatmakerUid: data.beatmakerUid ?? "",
    beatmakerNombre: data.beatmakerNombre ?? null,
    buyerUid: data.buyerUid ?? "",
    buyerNombre: data.buyerNombre ?? null,
    precio: typeof data.precio === "number" ? data.precio : 0,
    comision: typeof data.comision === "number" ? data.comision : 0,
    neto: typeof data.neto === "number" ? data.neto : 0,
    paidOut: data.paidOut === true,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    paidOutAt: typeof data.paidOutAt === "number" ? data.paidOutAt : undefined,
  };
}

/**
 * Inicia la compra de un beat: abre el chat de pago existente (mismo flujo que
 * premium/reserva) con el método elegido y el `precio` vigente del catálogo. El
 * precio se RECIBE del componente (que lo saca de `usePrecios()`), NO se importa
 * la constante: así el monto que ve el comprador == el que se le cobrará, sin
 * acoplar este repo a React. El server re-valida el monto (config-driven) al
 * confirmar. La venta (`BeatSale`) y la entrega del máster las crea el servidor
 * (`confirmPayment` → `confirmarPagoBeat`), no este repo.
 */
export async function comprarBeat(
  buyerUid: string,
  beat: Beat,
  metodo: MetodoPago,
  precio: number,
): Promise<string> {
  return createPaymentConversation({
    uid: buyerUid,
    concepto: "beat",
    ref: { kind: "beat", id: beat.id },
    metodo,
    monto: precio,
  });
}

/**
 * Todas las ventas de beats (SOLO admin — lo garantizan las reglas). Para el
 * panel de payout. Ordena en memoria (no en la query) para no requerir un
 * índice compuesto.
 */
export async function listBeatSales(): Promise<BeatSale[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map((d) => toBeatSale(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Compras de un usuario (sus beats comprados, con el link de descarga en el chat). */
export async function listMisCompras(uid: string): Promise<BeatSale[]> {
  const q = query(collection(db, COLLECTION), where("buyerUid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toBeatSale(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Marca el payout de una venta como pagado (transferencia MANUAL al beatmaker,
 * fuera de la app). Cambia dinero/estado server-authoritative: `beatSales` no
 * admite escritura desde el cliente (regla `write: false`), así que pasa por
 * esta Cloud Function callable en vez de `updateDoc`.
 */
const marcarBeatPayoutFn = httpsCallable<{ saleId: string }, { ok: boolean }>(
  functions,
  "marcarBeatPayout",
);
export async function marcarPayoutPagado(saleId: string): Promise<void> {
  await marcarBeatPayoutFn({ saleId });
}
