import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { alternatesFor } from "@/lib/seo";
import { ArtistsShowcase } from "@/features/artists/components/ArtistsShowcase";
import { ArtistCtaButton } from "@/features/artists/components/ArtistCtaButton";
import { GlassButton } from "@/components/ui/GlassButton";
import { ArrowLeftIcon } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("artistsPage");
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: alternatesFor(locale, "/artistas"),
  };
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
        {/* Atrás al inicio: mismo cristal "Liquid Glass" que el botón del perfil. */}
        <GlassButton href="/" className="mb-6">
          <ArrowLeftIcon className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
          {t("back")}
        </GlassButton>

        <h1 className="font-narrow text-5xl font-bold uppercase sm:text-7xl">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-xl text-white/60">{t("intro")}</p>
        <ArtistCtaButton />
      </header>

      <ArtistsShowcase fallback={[]} />
    </main>
  );
}
