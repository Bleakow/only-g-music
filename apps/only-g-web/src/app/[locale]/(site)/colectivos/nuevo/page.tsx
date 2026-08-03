import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CrearColectivoWizard } from "@/features/colectivos/components/CrearColectivoWizard";

/** Alta de colectivo (§07). Requiere sesión: la envuelve `RequireAuth`. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "crearColectivo" });
  return {
    title: `${t("title")} — Only G Music`,
    // Un formulario de alta no aporta nada en un buscador.
    robots: { index: false, follow: false },
  };
}

export default function NuevoColectivoPage() {
  return <CrearColectivoWizard />;
}
