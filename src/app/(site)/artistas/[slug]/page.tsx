import type { Metadata } from "next";
import {
  getArtistBySlug,
  getArtistSlugs,
} from "@/features/artists/lib/artists-repo";
import { ArtistProfileLoader } from "@/features/artists/components/profile/ArtistProfileLoader";
import { artistToProfile } from "@/features/artists/lib/profile-display";

export async function generateStaticParams() {
  const slugs = await getArtistSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) return { title: "Artista — Only G Music" };
  return {
    title: `${artist.name} — Only G Music`,
    description: artist.tagline,
  };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // El servidor pasa el artista semilla (si existe) como fallback para SEO/SSR;
  // el loader cliente lo reemplaza por el perfil real de Firestore si lo hay.
  const artist = await getArtistBySlug(slug);
  const fallback = artist ? artistToProfile(artist) : null;

  return <ArtistProfileLoader slug={slug} fallback={fallback} />;
}
