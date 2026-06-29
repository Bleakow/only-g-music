import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

/** Origen público del sitio, sin barra final. Config: NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/**
 * Alternates hreflang + canonical para una ruta SIN prefijo de locale
 * ("/servicios", o "/" para la home). Como `localePrefix: 'always'`, cada idioma
 * vive bajo su prefijo. URLs relativas → se resuelven contra `metadataBase`.
 */
export function alternatesFor(
  locale: string,
  path: string,
): NonNullable<Metadata["alternates"]> {
  const clean = path === "/" ? "" : path.replace(/\/$/, "");
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = `/${l}${clean}`;
  languages["x-default"] = `/${routing.defaultLocale}${clean}`;
  return { canonical: `/${locale}${clean}`, languages };
}
