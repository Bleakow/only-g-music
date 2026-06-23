import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("eventsPage");
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function EventosPage() {
  const t = await getTranslations();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-[4px] text-white/50">
        {t("common.comingSoon")}
      </p>
      <h1 className="mt-4 font-narrow text-5xl font-bold uppercase sm:text-7xl">
        {t("eventsPage.title")}
      </h1>
      <p className="mt-4 max-w-md text-white/60">{t("eventsPage.intro")}</p>
    </main>
  );
}
