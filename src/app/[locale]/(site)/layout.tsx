import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { HideOnAdmin } from "@/components/layout/HideOnAdmin";
import { ConversationBubble } from "@/features/conversations/components/ConversationBubble";

export default function SiteLayout({ children }: { children: ReactNode }) {
  // El chrome público se oculta en /admin (el panel trae su propio shell).
  return (
    <>
      <HideOnAdmin>
        <SiteHeader />
      </HideOnAdmin>
      {children}
      <HideOnAdmin>
        <SiteFooter />
        <ConversationBubble />
      </HideOnAdmin>
    </>
  );
}
