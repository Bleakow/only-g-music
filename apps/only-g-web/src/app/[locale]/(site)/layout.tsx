import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { HideOnOwnShell } from "@/components/layout/HideOnOwnShell";

export default function SiteLayout({ children }: { children: ReactNode }) {
  // El chrome público se oculta donde la pantalla trae su propio shell (/admin,
  // panel de métricas). El dock de herramientas (chat + G Note) NO va aquí: se
  // monta en `[locale]/layout` para que aparezca también en la home (fuera de
  // este group).
  return (
    <>
      <HideOnOwnShell>
        <SiteHeader />
      </HideOnOwnShell>
      {children}
      <HideOnOwnShell>
        <SiteFooter />
      </HideOnOwnShell>
    </>
  );
}
