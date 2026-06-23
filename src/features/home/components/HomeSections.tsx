import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Artist } from "@/domain/artist";
import { ArtistCard } from "@/features/artists/components/ArtistCard";

const SERVICE_KEYS = ["production", "videos", "events"] as const;

export async function HomeSections({ featured }: { featured: Artist[] }) {
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
            className="shrink-0 text-sm uppercase tracking-[2px] text-white/60 transition-colors hover:text-white"
          >
            {t("seeAll")}
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((artist) => (
            <ArtistCard key={artist.slug} artist={artist} />
          ))}
        </div>
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
