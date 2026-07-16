import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { alternatesFor } from "@/lib/seo";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  let name = "";
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artistProfiles/${slug}`,
      { next: { revalidate: 300 } },
    );
    if (res.ok) {
      const fields = (await res.json())?.fields ?? {};
      name = fields.artisticName?.stringValue ?? "";
    }
  } catch {
    /* sin red/perfil: cae al título de marca */
  }
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: name ? `${name} — Only G Music` : t("artistFallbackTitle"),
    description: name ? t("artistDescription", { name }) : t("rootDesc"),
    alternates: alternatesFor(locale, `/artistas/${slug}`),
  };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  return <ArtistProfileLoader slug={slug} fallback={null} />;
}
