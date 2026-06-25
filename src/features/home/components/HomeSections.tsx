import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HomeFeaturedArtists } from "@/features/artists/components/HomeFeaturedArtists";

const SERVICE_KEYS = ["production", "videos", "events"] as const;

export async function HomeSections() {
  const t = await getTranslations("home");

  return (
    <main>
      {/* Artistas destacados */}
      <section className="px-6 py-24 sm:px-12">
        <div className="mb-10 flex items-end justify-between gap-4">
          <h2 className="font-narrow text-4xl font-bold uppercase sm:text-6xl">
            {t("ourArtists")}
          </h2>
          <Link
            href="/artistas"
            className="shrink-0 text-sm tracking-[2px] text-white/60 uppercase transition-colors hover:text-white"
          >
            {t("seeAll")}
          </Link>
        </div>
        <HomeFeaturedArtists />
      </section>

      {/* Servicios */}
      <section className="px-6 py-24 sm:px-12">
        <h2 className="font-narrow text-4xl font-bold uppercase sm:text-6xl">
          {t("whatWeDo")}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {SERVICE_KEYS.map((key) => (
            <div
              key={key}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-8"
            >
              <h3 className="font-narrow text-2xl font-bold uppercase">
                {t(`services.${key}.title`)}
              </h3>
              <p className="mt-3 text-white/60">{t(`services.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
