import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Cliente y firmas de WOMPI (§09). Vive en functions y no en el paquete de
 * dominio porque toca SECRETOS: la llave privada y los secretos de integridad y
 * de eventos no pueden entrar en el bundle del navegador ni por accidente.
 *
 * La llave PÚBLICA sí es del cliente (tokeniza la tarjeta contra Wompi, para que
 * el número no pase nunca por nuestros servidores).
 */

/**
 * Sandbox o producción. Se decide por variable de entorno y no por `NODE_ENV`
 * para poder apuntar a sandbox desde producción mientras se prueba el flujo.
 */
export const WOMPI_BASE =
  process.env.WOMPI_ENV === "production"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";

/** Moneda única de la plataforma (Colombia). */
export const WOMPI_CURRENCY = "COP";

/**
 * Firma de INTEGRIDAD: viaja con la transacción y es lo que impide que alguien
 * cambie el importe por el camino. Wompi la exige como
 * `SHA256(referencia + monto_en_centavos + moneda + secreto_de_integridad)`.
 *
 * Se calcula AQUÍ y nunca en el cliente: si el navegador tuviera el secreto,
 * cualquiera podría firmar un pago de $1.000 por una membresía de $80.000.
 */
export function firmaIntegridad(
  reference: string,
  amountInCents: number,
  secret: string,
  currency: string = WOMPI_CURRENCY,
): string {
  return createHash("sha256")
    .update(`${reference}${amountInCents}${currency}${secret}`)
    .digest("hex");
}

/** Evento tal y como lo manda Wompi al webhook. */
export interface WompiEvent {
  event?: string;
  data?: { transaction?: Record<string, unknown> };
  timestamp?: number;
  signature?: { checksum?: string; properties?: string[] };
}

/** Lee `transaction.status` dentro del evento (rutas con puntos). */
function valorPorRuta(
  data: Record<string, unknown> | undefined,
  ruta: string,
): string {
  let actual: unknown = data;
  for (const parte of ruta.split(".")) {
    if (actual === null || typeof actual !== "object") return "";
    actual = (actual as Record<string, unknown>)[parte];
  }
  return actual === undefined || actual === null ? "" : String(actual);
}

/** Comparación en tiempo constante (no cortocircuita al primer byte distinto). */
function compararSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // `timingSafeEqual` LANZA si los tamaños difieren, así que se descarta antes.
  // La longitud sí se filtra, pero de un hash hexadecimal es siempre la misma.
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * ¿El evento viene de Wompi de verdad?
 *
 * El webhook es una URL PÚBLICA: sin esta comprobación, cualquiera que la
 * descubra puede mandarnos un `APPROVED` falso y llevarse una membresía gratis.
 * Wompi firma concatenando los valores de `signature.properties` (en ORDEN),
 * el `timestamp` y el secreto de eventos, y pasándolo por SHA-256.
 */
export function verificarChecksum(event: WompiEvent, secret: string): boolean {
  const recibido = event.signature?.checksum;
  const propiedades = event.signature?.properties;
  if (!recibido || !Array.isArray(propiedades) || propiedades.length === 0) {
    return false;
  }
  const concatenado = propiedades
    .map((ruta) => valorPorRuta(event.data as Record<string, unknown>, ruta))
    .join("");
  const calculado = createHash("sha256")
    .update(`${concatenado}${event.timestamp ?? ""}${secret}`)
    .digest("hex");
  return compararSeguro(calculado.toLowerCase(), recibido.toLowerCase());
}

/**
 * Token de aceptación de los términos: Wompi obliga a mandarlo en cada
 * transacción y a que el usuario haya visto el enlace (de ahí la casilla
 * "Acepto…" del mockup). Se pide con la llave PÚBLICA.
 */
export async function obtenerAcceptanceToken(
  publicKey: string,
): Promise<string> {
  const res = await fetch(`${WOMPI_BASE}/merchants/${publicKey}`);
  if (!res.ok) throw new Error(`merchants ${res.status}`);
  const json = (await res.json()) as {
    data?: { presigned_acceptance?: { acceptance_token?: string } };
  };
  const token = json.data?.presigned_acceptance?.acceptance_token;
  if (!token) throw new Error("sin acceptance_token");
  return token;
}

export interface NuevaTransaccion {
  reference: string;
  amountInCents: number;
  customerEmail: string;
  acceptanceToken: string;
  signature: string;
  paymentMethod: Record<string, unknown>;
  redirectUrl?: string;
}

export interface TransaccionCreada {
  id: string;
  status: string;
  redirectUrl?: string;
}

/**
 * Crea la transacción con la llave PRIVADA, desde el servidor.
 *
 * Podría crearse desde el navegador con la pública, pero entonces el importe lo
 * elegiría el cliente y solo lo defendería la firma. Creándola aquí, el monto
 * sale de nuestros datos y no hay nada que defender.
 */
export async function crearTransaccion(
  privateKey: string,
  t: NuevaTransaccion,
): Promise<TransaccionCreada> {
  const res = await fetch(`${WOMPI_BASE}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${privateKey}`,
    },
    body: JSON.stringify({
      amount_in_cents: t.amountInCents,
      currency: WOMPI_CURRENCY,
      customer_email: t.customerEmail,
      reference: t.reference,
      acceptance_token: t.acceptanceToken,
      signature: t.signature,
      payment_method: t.paymentMethod,
      redirect_url: t.redirectUrl,
    }),
  });
  const json = (await res.json()) as {
    data?: {
      id?: string;
      status?: string;
      payment_method?: { extra?: { async_payment_url?: string } };
    };
    error?: { reason?: string; messages?: unknown };
  };
  if (!res.ok || !json.data?.id) {
    throw new Error(
      `wompi ${res.status}: ${json.error?.reason ?? JSON.stringify(json.error ?? {})}`,
    );
  }
  return {
    id: json.data.id,
    status: json.data.status ?? "PENDING",
    // OJO: NO es `data.redirect_url`. Ese campo es el ECO de la url de retorno
    // que nosotros enviamos (nuestra propia página), así que navegar a él
    // recarga el sitio y mata el checkout. La url a la que hay que MANDAR al
    // usuario —el portal del banco en PSE— viene en `payment_method.extra`.
    redirectUrl: json.data.payment_method?.extra?.async_payment_url,
  };
}

/** Consulta el estado actual de una transacción (respaldo si falla el webhook). */
export async function consultarTransaccion(
  id: string,
): Promise<{ status: string; reference?: string } | null> {
  const res = await fetch(`${WOMPI_BASE}/transactions/${id}`);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: { status?: string; reference?: string };
  };
  return json.data?.status
    ? { status: json.data.status, reference: json.data.reference }
    : null;
}
