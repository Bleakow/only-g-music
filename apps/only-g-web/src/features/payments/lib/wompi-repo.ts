/**
 * Data-access del checkout de Wompi (§09).
 *
 * REPARTO DE RESPONSABILIDADES, que es lo que hay que entender de este archivo:
 *
 *   · La TARJETA se tokeniza aquí, en el navegador, contra Wompi y con la llave
 *     PÚBLICA. El número no pasa por nuestro backend ni aparece en un log
 *     nuestro: lo que viaja a nuestra Function es un token de un solo uso.
 *   · La TRANSACCIÓN la abre el servidor (`crearPagoWompi`), porque el importe
 *     no puede salir del cliente.
 *   · El ESTADO del pago no lo decide esta capa: se ESCUCHA de
 *     `wompiPagos/{reference}`, que solo escribe el webhook. Si la UI dedujera
 *     "aprobado" de la respuesta de Wompi, un usuario con la consola abierta se
 *     daría por pagado sin haber pagado.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import type { PagoWompi, WompiMetodo } from "@only-g/shared-types/wompi";

const COLLECTION = "wompiPagos";

/** Base de la API de Wompi. Sandbox salvo que se apunte a producción. */
const WOMPI_BASE =
  process.env.NEXT_PUBLIC_WOMPI_ENV === "production"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ?? "";

/** ¿Está configurada la pasarela? Sin llave pública, el checkout no se ofrece. */
export function wompiDisponible(): boolean {
  return PUBLIC_KEY.length > 0;
}

export interface DatosTarjeta {
  numero: string;
  cvc: string;
  /** Mes de vencimiento con dos dígitos ("09"). */
  mes: string;
  /** Año de vencimiento con dos dígitos ("29"). */
  anio: string;
  titular: string;
}

/**
 * Cambia los datos de la tarjeta por un token de Wompi. Se llama con la llave
 * PÚBLICA: es exactamente para lo que existe, y es lo que nos mantiene fuera del
 * alcance de PCI — nunca vemos ni almacenamos un número de tarjeta.
 */
export async function tokenizarTarjeta(t: DatosTarjeta): Promise<string> {
  const res = await fetch(`${WOMPI_BASE}/tokens/cards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PUBLIC_KEY}`,
    },
    body: JSON.stringify({
      number: t.numero.replace(/\s+/g, ""),
      cvc: t.cvc,
      exp_month: t.mes,
      exp_year: t.anio,
      card_holder: t.titular,
    }),
  });
  const json = (await res.json()) as {
    status?: string;
    data?: { id?: string };
    error?: { messages?: Record<string, string[]> };
  };
  if (!res.ok || !json.data?.id) {
    // El detalle del error de Wompi es útil (tarjeta vencida, CVC malo…), pero
    // no se propaga tal cual a la UI: lo traduce quien lo pinta.
    const detalle = JSON.stringify(json.error?.messages ?? {});
    throw new Error(`tarjeta-rechazada:${detalle}`);
  }
  return json.data.id;
}

/** Bancos disponibles para PSE. Los sirve Wompi y cambian, así que no se fijan. */
export interface BancoPse {
  financial_institution_code: string;
  financial_institution_name: string;
}

export async function listarBancosPse(): Promise<BancoPse[]> {
  const res = await fetch(
    `${WOMPI_BASE}/pse/financial_institutions`,
    { headers: { Authorization: `Bearer ${PUBLIC_KEY}` } },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: BancoPse[] };
  return json.data ?? [];
}

export interface NuevoPago {
  /** Chat de pago que da contexto: qué se compra y por cuánto. */
  conversationId: string;
  metodo: WompiMetodo;
  /** CARD: token devuelto por `tokenizarTarjeta`. */
  cardToken?: string;
  installments?: number;
  /** NEQUI: celular a 10 dígitos. */
  nequiPhone?: string;
  /** PSE: 0 = persona natural, 1 = jurídica. */
  pseUserType?: number;
  pseLegalIdType?: string;
  pseLegalId?: string;
  pseBank?: string;
  /** A dónde vuelve el usuario tras pagar fuera (PSE abre el banco). */
  redirectUrl?: string;
}

export interface PagoCreado {
  reference: string;
  transactionId: string;
  status: string;
  /** PSE y Bancolombia mandan al banco: hay que redirigir aquí. */
  redirectUrl?: string;
}

const crearPagoFn = httpsCallable<NuevoPago, PagoCreado>(
  functions,
  "crearPagoWompi",
);

/** Abre la transacción. El importe lo pone el servidor, no este objeto. */
export async function crearPago(pago: NuevoPago): Promise<PagoCreado> {
  const { data } = await crearPagoFn(pago);
  return data;
}

/**
 * Escucha el pago en tiempo real. Es la pieza que hace posible el flujo de
 * Nequi: el usuario aprueba en su móvil, Wompi avisa a nuestro webhook y la
 * pantalla cambia sola, sin que el usuario tenga que refrescar ni nosotros
 * preguntar en bucle.
 *
 * Devuelve la función para dejar de escuchar (llamarla al desmontar).
 */
export function escucharPago(
  reference: string,
  onChange: (pago: PagoWompi | null) => void,
  onError?: (e: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, COLLECTION, reference),
    (snap) => onChange(snap.exists() ? (snap.data() as PagoWompi) : null),
    (e) => {
      // NO se traga el error devolviendo `null`: un fallo de lectura (reglas sin
      // desplegar, sesión caída) se pintaría idéntico a "pendiente" y el usuario
      // se quedaría mirando "Pago en proceso" para siempre mientras el error
      // vive en una consola que nadie abre. Quien escucha decide qué mostrar.
      console.error("[wompi] escucha:", e);
      onError?.(e);
    },
  );
}
