import type { Metadata } from "next";
import Link from "next/link";
import { getAllArtists } from "@/features/artists/lib/artists-repo";
import { ArtistGrid } from "@/features/artists/components/ArtistGrid";

export const metadata: Metadata = {
  title: "Artistas — Only G Music",
  description: "El roster de Only G: los artistas que hacen el sonido.",
};

export default async function ArtistasPage() {
  const artists = await getAllArtists();

  return (
    <main className="min-h-dvh px-6 pb-24 pt-28 sm:px-12">
      <header className="mb-12">
        <h1 className="font-narrow text-5xl font-bold uppercase sm:text-7xl">
          Artistas
        </h1>
        <p className="mt-2 max-w-xl text-white/60">
          El roster de Only G. Conoce a quienes hacen el sonido.
        </p>
        <Link
          href="/artista/nuevo"
          className="mt-5 inline-flex rounded-full border border-amethyst-400/60 px-5 py-2.5 text-sm font-semibold uppercase tracking-[2px] text-amethyst-200 transition hover:border-amethyst-300 hover:bg-amethyst-500/10 hover:text-white"
        >
          ¿Eres artista? Crea tu perfil →
        </Link>
      </header>

      <ArtistGrid artists={artists} />
    </main>
  );
}
