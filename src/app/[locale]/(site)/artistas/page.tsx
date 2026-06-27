import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArtistsShowcase } from "@/features/artists/components/ArtistsShowcase";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("artistsPage");
  return { title: t("metaTitle"), description: t("metaDesc") };
}

// La vitrina lee los perfiles reales de Firestore en CLIENTE (ArtistsShowcase).
// Este Server Component NO importa el SDK web de Firebase (rompería el build de
// producción al inicializarlo en el servidor); la lista arranca vacía y el
// cliente la rellena.
export default async function ArtistasPage() {
  const t = await getTranslations("artistsPage");

  return (
    <main className="min-h-dvh px-6 pt-28 pb-24 sm:px-12">
      <header className="mb-12">
        <h1 className="font-narrow text-5xl font-bold uppercase sm:text-7xl">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-xl text-white/60">{t("intro")}</p>
        <Link
          href="/artista/nuevo"
          className="border-amethyst-400/60 text-amethyst-200 hover:border-amethyst-300 hover:bg-amethyst-500/10 mt-5 inline-flex rounded-full border px-5 py-2.5 text-sm font-semibold tracking-[2px] uppercase transition hover:text-white"
        >
          {t("createProfile")}
        </Link>
      </header>

      <ArtistsShowcase fallback={[]} />
    </main>
  );
}
