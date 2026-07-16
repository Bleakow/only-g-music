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
    <main className="min-h-dvh pb-24">
      {/* ── Cabecera editorial con resplandor amatista de marca ───────── */}
      <header className="relative overflow-hidden px-6 pt-6 pb-14 sm:px-12 sm:pb-20">
        {/* Backdrop: glow amatista (mismo lenguaje visual que el hero y el menú). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(115% 130% at 12% -15%, rgba(124,58,237,0.28), transparent 55%), radial-gradient(90% 120% at 95% 0%, rgba(196,165,255,0.12), transparent 50%)",
          }}
        />
        {/* Hairline inferior: separa la cabecera de la cuadrícula sin línea dura. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent sm:inset-x-12"
        />

        {/* Atrás: pastilla glass integrada en la cabecera (patrón de los perfiles).
            En flujo, arriba a la izquierda; alineada con la hamburguesa de la derecha. */}
        <GlassButton href="/">
          <ArrowLeftIcon className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
          {t("back")}
        </GlassButton>

        <div className="mt-14 sm:mt-20">
          <p className="text-amethyst-300 text-xs font-medium tracking-[4px] uppercase">
            {t("kicker")}
          </p>
          <h1 className="font-narrow mt-3 text-6xl leading-[0.9] font-bold uppercase sm:text-8xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/60 sm:text-lg">
            {t("intro")}
          </p>
          <ArtistCtaButton />
        </div>
      </header>

      {/* ── Cuadrícula de artistas ────────────────────────────────────── */}
      <div className="px-6 sm:px-12">
        <ArtistsShowcase fallback={[]} />
      </div>
    </main>
  );
}
