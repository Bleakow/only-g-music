"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * Oculta el chrome público del sitio (header, footer, burbuja de chat) dentro del
 * panel admin, que tiene su PROPIO shell (sidebar + topbar). Es un wrapper cliente
 * que decide si renderizar sus `children`: así puede envolver incluso componentes
 * de servidor (como `SiteFooter`) sin convertirlos — el server component se
 * renderiza y se pasa ya resuelto; aquí solo se decide mostrarlo o no.
 */
export function HideOnAdmin({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <>{children}</>;
}
