/**
 * Repositorio (data-access) de PAYOUTS: colección `payouts` (cuentas por pagar a
 * socios). La UI nunca toca Firestore/Functions directo. SOLO LECTURA desde el
 * cliente: los payouts los CREA el servidor (`confirmarPagoBeat` /
 * `backfillPayouts`) — `payouts` no admite escritura desde el cliente (regla
 * `write: false`). Mismo patrón que `pasivos-repo`/`beat-sales-repo` (mapper con
 * toMillis, httpsCallable para lo server-authoritative).
 *
 * Frontera de lectura (la blindan las reglas): el admin lee TODAS (panel +
 * balance); el ACREEDOR (socio) lee solo las SUYAS.
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
import type { Payout } from "@/domain/payout";

const COLLECTION = "payouts";

/** Lee un instante que puede venir como Timestamp (auditoría) o número (epoch ms). */
function toMillis(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  const ts = v as { toMillis?: () => number };
  return ts.toMillis?.();
}

/** Mapea un documento de Firestore al modelo de dominio. */
function toPayout(id: string, data: DocumentData): Payout {
  return {
    id,
    acreedorUid: data.acreedorUid ?? "",
    acreedorNombre: data.acreedorNombre ?? null,
    origen: data.origen === "produccion" ? "produccion" : "beat",
    refId: data.refId ?? "",
    sede: data.sede ?? undefined,
    nota: data.nota ?? undefined,
    monto: typeof data.monto === "number" ? data.monto : 0,
    estado: data.estado === "pagado" ? "pagado" : "pendiente",
    createdAt: toMillis(data.createdAt) ?? Date.now(),
    pagadoAt: toMillis(data.pagadoAt),
    metodo: data.metodo ?? undefined,
    comprobanteUrl: data.comprobanteUrl ?? undefined,
    registradoPor: data.registradoPor ?? undefined,
  };
}

/**
 * Todos los payouts (SOLO admin — lo garantizan las reglas). Para el panel y el
 * Balance. Ordena en memoria (no en la query) para no requerir un índice.
 */
export async function listPayouts(): Promise<Payout[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map((d) => toPayout(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Payouts de UN socio (los que se le deben a él). La regla permite leer solo los
 * propios (`acreedorUid == uid`); el `where` debe coincidir con esa frontera.
 */
export async function listMisPayouts(uid: string): Promise<Payout[]> {
  const q = query(collection(db, COLLECTION), where("acreedorUid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toPayout(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Backfill (SOLO admin): genera los `payouts` faltantes desde las `beatSales`
 * históricas aún no pagadas. Server-authoritative (Cloud Function callable),
 * idempotente (id determinista). Devuelve cuántos payouts se sincronizaron.
 */
const backfillPayoutsFn = httpsCallable<Record<string, never>, { count: number }>(
  functions,
  "backfillPayouts",
);
export async function backfillPayouts(): Promise<number> {
  const res = await backfillPayoutsFn({});
  return res.data.count;
}

/** Método con el que Only G liquida a un socio (sub-conjunto de `MetodoPagoSocio`). */
export type MetodoLiquidacion = "banco" | "nequi" | "efectivo";

/**
 * Registra la LIQUIDACIÓN de un payout (SOLO admin): lo marca pagado con método y
 * comprobante opcional. Cambia dinero/estado server-authoritative (`payouts` no
 * admite escritura desde el cliente): pasa por la Cloud Function `registrarPagoPayout`,
 * que además sincroniza `beatSales.paidOut` en los payouts de beat. Idempotente.
 */
const registrarPagoPayoutFn = httpsCallable<
  { payoutId: string; metodo: MetodoLiquidacion; comprobanteUrl?: string },
  { ok: boolean }
>(functions, "registrarPagoPayout");
export async function registrarPagoPayout(
  payoutId: string,
  metodo: MetodoLiquidacion,
  comprobanteUrl?: string,
): Promise<void> {
  await registrarPagoPayoutFn({ payoutId, metodo, comprobanteUrl });
}

/**
 * "Pagar todo": liquida en LOTE todos los payouts de una persona (SOLO admin) con el
 * mismo método + comprobante. Idempotente por elemento. Devuelve cuántos se liquidaron.
 */
const registrarPagosPayoutFn = httpsCallable<
  { payoutIds: string[]; metodo: MetodoLiquidacion; comprobanteUrl?: string },
  { count: number }
>(functions, "registrarPagosPayout");
export async function registrarPagosPayout(
  payoutIds: string[],
  metodo: MetodoLiquidacion,
  comprobanteUrl?: string,
): Promise<number> {
  const res = await registrarPagosPayoutFn({ payoutIds, metodo, comprobanteUrl });
  return res.data.count;
}

/**
 * Registra a mano una cuenta por pagar a un PRODUCTOR (SOLO admin, Fase 4): el
 * admin declara el NETO directo que Only G le debe por su trabajo (sin comisión
 * automática). Server-authoritative (`payouts` no admite escritura desde el
 * cliente): pasa por la Cloud Function `registrarPayoutProduccion`, que valida el
 * rol `productor` del destinatario y genera un id `prod_*`. Devuelve el id creado.
 */
const registrarPayoutProduccionFn = httpsCallable<
  { acreedorUid: string; monto: number; sede?: string; nota?: string },
  { ok: boolean; id: string }
>(functions, "registrarPayoutProduccion");
export async function registrarPayoutProduccion(data: {
  acreedorUid: string;
  monto: number;
  sede?: string;
  nota?: string;
}): Promise<string> {
  const res = await registrarPayoutProduccionFn(data);
  return res.data.id;
}
