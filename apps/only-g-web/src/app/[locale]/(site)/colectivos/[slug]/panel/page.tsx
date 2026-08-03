import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { ColectivoPanel } from "@/features/colectivos/components/ColectivoPanel";

/** Panel de control del colectivo (§07). Solo para quien puede gestionarlo. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "colectivoPanel" });
  return {
    title: t("title"),
    // Panel privado: no tiene por qué aparecer en un buscador.
    robots: { index: false, follow: false },
  };
}

export default async function PanelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <RequireAuth>
      <ColectivoPanel slug={slug} />
    </RequireAuth>
  );
}
