import type { Metadata } from "next";
import { ArtistProfileLoader } from "@/features/artists/components/profile/ArtistProfileLoader";

/**
 * Render DINÁMICO (SSR on-demand). El perfil se carga en CLIENTE desde Firestore
 * (`ArtistProfileLoader`), así que no hay nada que prerenderizar.
 *
 * CAUSA DEL 500 EN PROD: tener `generateStaticParams` (aunque devolviera []) marca
 * la ruta como SSG; al intentar la generación estática, el árbol usa APIs
 * dinámicas y Next lanza `DYNAMIC_SERVER_USAGE` → 500 SOLO en producción (en dev
 * se perdona). La solución es declararla dinámica, como /admin/.../editar (que sí
 * funciona por NO tener generateStaticParams).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Artista — Only G Music" };

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  return <ArtistProfileLoader slug={slug} fallback={null} />;
}
