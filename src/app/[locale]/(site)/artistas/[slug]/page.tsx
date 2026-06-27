import type { Metadata } from "next";
import { ArtistProfileLoader } from "@/features/artists/components/profile/ArtistProfileLoader";

/**
 * Los perfiles de artista viven en Firestore y se cargan en CLIENTE
 * (`ArtistProfileLoader`). IMPORTANTE: este Server Component NO debe importar el
 * SDK web de Firebase (vía artists-repo). Hacerlo lo inicializa del lado servidor
 * (getAuth/getFirestore en el módulo) y rompe el build de producción de App
 * Hosting con un 500 — aunque en dev funcione. Sin semillas no hay fallback ni
 * params estáticos: todo es dinámico, en cliente.
 */
export function generateStaticParams(): { slug: string }[] {
  return [];
}

export const metadata: Metadata = { title: "Artista — Only G Music" };

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  return <ArtistProfileLoader slug={slug} fallback={null} />;
}
