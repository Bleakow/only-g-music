import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/*/admin",
        "/*/consola",
        "/*/cuenta",
        "/*/solicitudes",
        "/*/artista/", // editor (singular); NO bloquea /artistas/{slug} (plural)
        "/*/disponibilidad",
        "/*/login",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
