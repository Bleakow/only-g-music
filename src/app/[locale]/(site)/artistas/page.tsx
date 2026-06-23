import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAllArtists } from "@/features/artists/lib/artists-repo";
import { ArtistsShowcase } from "@/features/artists/components/ArtistsShowcase";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("artistsPage");
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function ArtistasPage() {
  const t = await getTranslations("artistsPage");
  const artists = await getAllArtists();

  return (
    <main className="min-h-dvh px-6 pb-24 pt-28 sm:px-12">
      <header className="mb-12">
        <h1 className="font-narrow text-5xl font-bold uppercase sm:text-7xl">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-xl text-white/60">{t("intro")}</p>
        <Link
          href="/artista/nuevo"
          className="mt-5 inline-flex rounded-full border border-amethyst-400/60 px-5 py-2.5 text-sm font-semibold uppercase tracking-[2px] text-amethyst-200 transition hover:border-amethyst-300 hover:bg-amethyst-500/10 hover:text-white"
        >
          {t("createProfile")}
        </Link>
      </header>

      <ArtistsShowcase fallback={artists} />
    </main>
  );
}
