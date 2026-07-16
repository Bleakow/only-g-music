import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { HideOnAdmin } from "@/components/layout/HideOnAdmin";

export default function SiteLayout({ children }: { children: ReactNode }) {
  // El chrome público se oculta en /admin (el panel trae su propio shell).
  // El dock de herramientas (chat + G Note) NO va aquí: se monta en
  // `[locale]/layout` para que aparezca también en la home (fuera de este group).
  return (
    <>
      <HideOnAdmin>
        <SiteHeader />
      </HideOnAdmin>
      {children}
      <HideOnAdmin>
        <SiteFooter />
      </HideOnAdmin>
    </>
  );
}
