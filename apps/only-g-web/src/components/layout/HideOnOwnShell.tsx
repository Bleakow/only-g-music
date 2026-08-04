"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * Rutas que traen su PROPIO shell: una cabecera con su navegación y sus controles
 * pegados a las esquinas. Todo el chrome público (logo/hamburguesa, dock de
 * cuenta, burbuja de chat) es `position: fixed` con z-index alto, así que se les
 * monta encima: en Métricas la cápsula del dock tapaba el selector de rango.
 */
function hasOwnShell(pathname: string): boolean {
  // El panel admin: sidebar + topbar propios.
  if (pathname.startsWith("/admin")) return true;
  // El panel de métricas del perfil: /artistas/{slug}/metricas.
  return /^\/artistas\/[^/]+\/metricas$/.test(pathname);
}

/**
 * Oculta el chrome público del sitio (header, footer, dock, burbuja de chat) en
 * las rutas que se gobiernan solas. Es un wrapper cliente que decide si renderizar
 * sus `children`: así puede envolver incluso componentes de servidor (como
 * `SiteFooter`) sin convertirlos — el server component se renderiza y se pasa ya
 * resuelto; aquí solo se decide mostrarlo o no.
 */
export function HideOnOwnShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (hasOwnShell(pathname)) return null;
  return <>{children}</>;
}
