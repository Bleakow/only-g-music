/**
 * Resolución del PAÍS de un visitante sin geo-IP, sin cookies y sin pedir
 * permisos: a partir de su zona horaria IANA (`America/Bogota` → `CO`) y, como
 * apoyo, de la región de su locale (`es-CO` → `CO`).
 *
 * POR QUÉ ASÍ. La alternativa era un servicio de geolocalización por IP: cuesta
 * dinero, añade latencia a cada visita y trata una IP (dato personal) para una
 * métrica de vanidad. La zona horaria ya la manda el navegador sin preguntar a
 * nadie y acierta en la enorme mayoría de casos.
 *
 * LÍMITE ACEPTADO: quien use VPN o tenga el reloj en otro huso se contará en el
 * país equivocado. Igual que el contador de visitas, esto es una métrica de
 * vanidad, no una fuente de verdad para facturar.
 *
 * Este módulo solo lo usa la API de registro (server-side), así que la tabla no
 * viaja al navegador.
 */

/**
 * Zona IANA → ISO-3166-1 alfa-2. Cubre los países con población relevante; las
 * zonas de un mismo país comparten código (EE. UU. tiene seis, España dos).
 * Lo que no esté aquí cae a `null` y se agrupa como "Otros" en el panel.
 */
const TZ_TO_COUNTRY: Record<string, string> = {
  // ── América Latina (el grueso del tráfico de Only G) ──────────────────
  "America/Bogota": "CO",
  "America/Mexico_City": "MX",
  "America/Cancun": "MX",
  "America/Monterrey": "MX",
  "America/Tijuana": "MX",
  "America/Chihuahua": "MX",
  "America/Hermosillo": "MX",
  "America/Mazatlan": "MX",
  "America/Merida": "MX",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Argentina/Cordoba": "AR",
  "America/Argentina/Mendoza": "AR",
  "America/Argentina/Salta": "AR",
  "America/Argentina/Tucuman": "AR",
  "America/Argentina/Ushuaia": "AR",
  "America/Santiago": "CL",
  "America/Punta_Arenas": "CL",
  "America/Lima": "PE",
  "America/Caracas": "VE",
  "America/Guayaquil": "EC",
  "America/La_Paz": "BO",
  "America/Asuncion": "PY",
  "America/Montevideo": "UY",
  "America/Sao_Paulo": "BR",
  "America/Bahia": "BR",
  "America/Fortaleza": "BR",
  "America/Recife": "BR",
  "America/Manaus": "BR",
  "America/Belem": "BR",
  "America/Cuiaba": "BR",
  "America/Porto_Velho": "BR",
  "America/Panama": "PA",
  "America/Costa_Rica": "CR",
  "America/Guatemala": "GT",
  "America/Tegucigalpa": "HN",
  "America/Managua": "NI",
  "America/El_Salvador": "SV",
  "America/Havana": "CU",
  "America/Santo_Domingo": "DO",
  "America/Port-au-Prince": "HT",
  "America/Puerto_Rico": "PR",
  "America/Jamaica": "JM",
  "America/Nassau": "BS",
  "America/Barbados": "BB",
  "America/Port_of_Spain": "TT",
  "America/Paramaribo": "SR",
  "America/Guyana": "GY",
  "America/Belize": "BZ",
  "America/Curacao": "CW",
  "America/Aruba": "AW",

  // ── Norteamérica ──────────────────────────────────────────────────────
  "America/New_York": "US",
  "America/Detroit": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "America/Indiana/Indianapolis": "US",
  "America/Kentucky/Louisville": "US",
  "America/Boise": "US",
  "Pacific/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/St_Johns": "CA",
  "America/Regina": "CA",

  // ── Europa ────────────────────────────────────────────────────────────
  "Europe/Madrid": "ES",
  "Atlantic/Canary": "ES",
  "Europe/Lisbon": "PT",
  "Atlantic/Azores": "PT",
  "Atlantic/Madeira": "PT",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Brussels": "BE",
  "Europe/Amsterdam": "NL",
  "Europe/Berlin": "DE",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Rome": "IT",
  "Europe/Malta": "MT",
  "Europe/Athens": "GR",
  "Europe/Istanbul": "TR",
  "Europe/Moscow": "RU",
  "Europe/Kaliningrad": "RU",
  "Asia/Yekaterinburg": "RU",
  "Asia/Novosibirsk": "RU",
  "Asia/Vladivostok": "RU",
  "Europe/Kyiv": "UA",
  "Europe/Kiev": "UA",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Bratislava": "SK",
  "Europe/Budapest": "HU",
  "Europe/Bucharest": "RO",
  "Europe/Sofia": "BG",
  "Europe/Belgrade": "RS",
  "Europe/Zagreb": "HR",
  "Europe/Ljubljana": "SI",
  "Europe/Sarajevo": "BA",
  "Europe/Skopje": "MK",
  "Europe/Tirane": "AL",
  "Europe/Chisinau": "MD",
  "Europe/Minsk": "BY",
  "Europe/Vilnius": "LT",
  "Europe/Riga": "LV",
  "Europe/Tallinn": "EE",
  "Europe/Helsinki": "FI",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Atlantic/Reykjavik": "IS",
  "Europe/Luxembourg": "LU",
  "Europe/Andorra": "AD",
  "Europe/Monaco": "MC",

  // ── África ────────────────────────────────────────────────────────────
  "Africa/Casablanca": "MA",
  "Africa/Algiers": "DZ",
  "Africa/Tunis": "TN",
  "Africa/Tripoli": "LY",
  "Africa/Cairo": "EG",
  "Africa/Lagos": "NG",
  "Africa/Accra": "GH",
  "Africa/Abidjan": "CI",
  "Africa/Dakar": "SN",
  "Africa/Bamako": "ML",
  "Africa/Nairobi": "KE",
  "Africa/Kampala": "UG",
  "Africa/Dar_es_Salaam": "TZ",
  "Africa/Addis_Ababa": "ET",
  "Africa/Khartoum": "SD",
  "Africa/Johannesburg": "ZA",
  "Africa/Luanda": "AO",
  "Africa/Maputo": "MZ",
  "Africa/Harare": "ZW",
  "Africa/Kinshasa": "CD",
  "Africa/Douala": "CM",

  // ── Asia y Oriente Medio ──────────────────────────────────────────────
  "Asia/Jerusalem": "IL",
  "Asia/Beirut": "LB",
  "Asia/Damascus": "SY",
  "Asia/Amman": "JO",
  "Asia/Baghdad": "IQ",
  "Asia/Riyadh": "SA",
  "Asia/Dubai": "AE",
  "Asia/Qatar": "QA",
  "Asia/Kuwait": "KW",
  "Asia/Tehran": "IR",
  "Asia/Karachi": "PK",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Colombo": "LK",
  "Asia/Dhaka": "BD",
  "Asia/Kathmandu": "NP",
  "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Saigon": "VN",
  "Asia/Jakarta": "ID",
  "Asia/Makassar": "ID",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Singapore": "SG",
  "Asia/Manila": "PH",
  "Asia/Hong_Kong": "HK",
  "Asia/Taipei": "TW",
  "Asia/Shanghai": "CN",
  "Asia/Urumqi": "CN",
  "Asia/Seoul": "KR",
  "Asia/Tokyo": "JP",
  "Asia/Almaty": "KZ",
  "Asia/Tashkent": "UZ",
  "Asia/Baku": "AZ",
  "Asia/Tbilisi": "GE",
  "Asia/Yerevan": "AM",

  // ── Oceanía ───────────────────────────────────────────────────────────
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Australia/Darwin": "AU",
  "Australia/Hobart": "AU",
  "Pacific/Auckland": "NZ",
  "Pacific/Fiji": "FJ",
  "Pacific/Guam": "GU",
  "Pacific/Port_Moresby": "PG",
};

/** ISO-2 válidos que aceptamos de la región del locale (evita basura tipo `419`). */
const ISO2 = /^[A-Z]{2}$/;

/**
 * Deduce el país del visitante. Prioriza la ZONA HORARIA (indica dónde está) y
 * solo cae al locale si la zona no está en la tabla — el idioma dice qué habla,
 * no dónde vive, así que es peor señal: un colombiano en Madrid con el navegador
 * en `es-CO` vive en España.
 *
 * Devuelve el ISO-2 en mayúsculas, o `null` si no hay forma de saberlo (el panel
 * lo agrupa como "Otros" en vez de inventarse un país).
 */
export function countryFromClient(
  timeZone?: string | null,
  locale?: string | null,
): string | null {
  const tz = timeZone?.trim();
  if (tz) {
    const byTz = TZ_TO_COUNTRY[tz];
    if (byTz) return byTz;
  }

  // Locale tipo `es-CO`, `pt-BR`, `en-US`. Sin región (`es`) no aporta nada.
  const region = locale?.trim().split(/[-_]/)[1]?.toUpperCase();
  if (region && ISO2.test(region)) return region;

  return null;
}

/** Nº de zonas horarias cubiertas por la tabla (para tests y diagnóstico). */
export const TIMEZONE_COVERAGE = Object.keys(TZ_TO_COUNTRY).length;
