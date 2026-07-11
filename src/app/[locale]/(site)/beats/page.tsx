import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { alternatesFor } from "@/lib/seo";
import { GlassButton } from "@/components/ui/GlassButton";
import { ArrowLeftIcon } from "@/components/icons";
import { BeatsCatalog } from "@/features/beats/components/BeatsCatalog";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("beats");
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: alternatesFor(locale, "/beats"),
  };
}

// El catálogo lee los beats reales de Firestore en CLIENTE (BeatsCatalog).
// Este Server Component NO importa el SDK web de Firebase (mismo criterio que
// /artistas): arranca vacío y el cliente lo rellena.
export default async function BeatsPage() {
  const t = await getTranslations("beats");

  return (
    <main className="min-h-dvh pb-24">
      {/* ── Cabecera editorial (mismo lenguaje visual que /artistas) ──── */}
      <header className="relative overflow-hidden px-6 pt-6 pb-14 sm:px-12 sm:pb-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(115% 130% at 12% -15%, rgba(124,58,237,0.28), transparent 55%), radial-gradient(90% 120% at 95% 0%, rgba(196,165,255,0.12), transparent 50%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent sm:inset-x-12"
        />

        <GlassButton href="/">
          <ArrowLeftIcon className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
          {t("back")}
        </GlassButton>

        <div className="mt-14 sm:mt-20">
          <h1 className="font-narrow mt-3 text-6xl leading-[0.9] font-bold uppercase sm:text-8xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/60 sm:text-lg">
            {t("intro")}
          </p>
        </div>
      </header>

      {/* ── Catálogo (filtros + grid) ─────────────────────────────────── */}
      <div className="px-6 sm:px-12">
        <BeatsCatalog />
      </div>
    </main>
  );
}
