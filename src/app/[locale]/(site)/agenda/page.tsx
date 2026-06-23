import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookingCalendar } from "@/features/booking/components/BookingCalendar";
import { RequireAuth } from "@/features/auth/components/RequireAuth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agendaPage");
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string }>;
}) {
  const { servicio } = await searchParams;
  const t = await getTranslations();
  return (
    <RequireAuth
      title={t("guards.bookTitle")}
      message={t("guards.bookMessage")}
    >
      <main className="min-h-dvh px-6 pb-24 pt-28 sm:px-12">
        <header className="mb-10 text-center">
          <p className="text-sm uppercase tracking-[4px] text-amethyst-300">
            {t("agendaPage.eyebrow")}
          </p>
          <h1 className="mt-3 font-narrow text-5xl font-bold uppercase sm:text-7xl">
            {t("agendaPage.title")}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-silver-300">
            {t("agendaPage.intro")}
          </p>
        </header>

        <BookingCalendar servicioSlug={servicio} />
      </main>
    </RequireAuth>
  );
}
