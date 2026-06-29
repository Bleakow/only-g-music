import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("productionsPage");
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: alternatesFor(locale, "/producciones"),
  };
}

export default async function ProduccionesPage() {
  const t = await getTranslations();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-[4px] text-white/50">
        {t("common.comingSoon")}
      </p>
      <h1 className="mt-4 font-narrow text-5xl font-bold uppercase sm:text-7xl">
        {t("productionsPage.title")}
      </h1>
      <p className="mt-4 max-w-md text-white/60">{t("productionsPage.intro")}</p>
    </main>
  );
}
