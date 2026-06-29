/**
 * Canal de WhatsApp para avisos internos de Only G, vía CallMeBot.
 *
 * LÍMITE DE CALLMEBOT (clave): la API gratuita SOLO escribe a números que se
 * registraron ELLOS MISMOS en el bot (mandándole "I allow callmebot to send me
 * messages" desde su móvil y obteniendo su apikey personal). Por eso este canal es
 * para el número del NEGOCIO (un único destinatario opt-in), NO para clientes. Las
 * confirmaciones a clientes llegan en la Fase 2 con Meta WhatsApp Cloud API, que sí
 * permite escribir a cualquier número con plantillas aprobadas.
 *
 * Diseñado como SEAM de transporte: `sendWhatsApp(phone, apikey, text)` es agnóstico
 * del proveedor; hoy lo cumple CallMeBot, mañana Meta cambia solo el "cómo se manda".
 *
 * Config por `defineString` desde `functions/.env` (gitignored). Si los valores
 * están vacíos, todo es un NO-OP silencioso: despliega y funciona sin romper nada
 * hasta que se configure. La apikey de CallMeBot es de bajo riesgo (solo autoriza
 * escribir al propio número); si se quisiera blindar, cambiar a `defineSecret` y
 * enlazarla en cada Function que la use.
 *
 * Best-effort: nunca lanza. Un aviso jamás debe romper la lógica que lo dispara.
 */
import { defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

/** Número de WhatsApp de Only G con código de país (ej. +57300...). */
const CALLMEBOT_PHONE = defineString("CALLMEBOT_PHONE", { default: "" });
/** apikey personal del número de Only G en CallMeBot. */
const CALLMEBOT_APIKEY = defineString("CALLMEBOT_APIKEY", { default: "" });
/** Origen del sitio para enlaces profundos en el mensaje (ej. https://...). Opcional. */
const SITE_URL = defineString("SITE_URL", { default: "" });

/** Timeout duro: que un CallMeBot lento no cuelgue la Function. */
const TIMEOUT_MS = 8000;

/**
 * Transporte agnóstico: manda `text` al `phone` con la `apikey` dada vía CallMeBot
 * (GET, texto URL-encoded). Devuelve true si la respuesta fue OK. Best-effort.
 */
export async function sendWhatsApp(
  phone: string,
  apikey: string,
  text: string,
): Promise<boolean> {
  if (!phone || !apikey || !text) return false;
  const qs = new URLSearchParams({ phone, text, apikey }).toString();
  const url = `https://api.callmebot.com/whatsapp.php?${qs}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      logger.warn(`[whatsapp] CallMeBot respondió ${res.status}`);
      return false;
    }
    return true;
  } catch (e) {
    logger.error("[whatsapp] envío falló", e);
    return false;
  }
}

/**
 * Manda un aviso al WhatsApp del NEGOCIO (Only G). No-op silencioso si no está
 * configurado (phone/apikey vacíos): el resto sigue igual sin tocar nada.
 */
export async function notifyAdminWhatsApp(text: string): Promise<void> {
  const phone = CALLMEBOT_PHONE.value();
  const apikey = CALLMEBOT_APIKEY.value();
  if (!phone || !apikey) return; // aún sin configurar → no-op
  await sendWhatsApp(phone, apikey, text);
}

/**
 * Devuelve un enlace profundo (en su propia línea) a partir de una ruta relativa,
 * o "" si SITE_URL no está configurado. Listo para concatenar al texto del aviso.
 */
export function deepLink(ruta: string): string {
  const base = SITE_URL.value();
  if (!base || !ruta) return "";
  return `\n${base}${ruta}`;
}
