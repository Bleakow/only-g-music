import { defineRouting } from "next-intl/routing";

/**
 * Configuración de idiomas. ES es la base; EN el segundo. `localePrefix: always`
 * → URLs visibles con prefijo en AMBOS (`/es/...`, `/en/...`): mejor SEO/hreflang.
 * Añadir un idioma = añadirlo aquí + su catálogo en `messages/`.
 */
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
