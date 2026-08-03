import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { alternatesFor } from "@/lib/seo";
import { ColectivosDirectory } from "@/features/colectivos/components/ColectivosDirectory";

/** Directorio de colectivos (§07). La lista se carga en cliente desde Firestore. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "colectivos" });
  return {
    title: `${t("title")} — Only G Music`,
    description: t("intro"),
    alternates: alternatesFor(locale, "/colectivos"),
  };
}

export default function ColectivosPage() {
  return <ColectivosDirectory />;
}
