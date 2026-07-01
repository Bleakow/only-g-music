/**
 * Config de pago de la compañía: el destino por DEFECTO (a dónde van los pagos
 * mientras una sede no traiga su propio override). Doc singleton `config/payments`.
 * Lo edita el admin (reglas); si aún no existe, fallback vacío. El QR/número real
 * lo siembra el negocio (por ahora vía consola; UI admin, más adelante).
 */
import { getDoc, setDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DestinoPago } from "@/domain/payment-destination";

export async function getCompanyPaymentDest(): Promise<DestinoPago> {
  const snap = await getDoc(doc(db, "config", "payments"));
  return snap.exists() ? (snap.data() as DestinoPago) : {};
}

/** Reemplaza el destino de pago por defecto de la compañía (SOLO admin). */
export async function setCompanyPaymentDest(destino: DestinoPago): Promise<void> {
  await setDoc(doc(db, "config", "payments"), destino);
}
