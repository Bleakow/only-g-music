import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { alternatesFor } from "@/lib/seo";
import { ColectivoLoader } from "@/features/colectivos/components/ColectivoLoader";

/**
 * Perfil público de un colectivo (§07). Dinámica por el mismo motivo que el
 * perfil de artista: los datos se leen en cliente desde Firestore, y declararla
 * SSG haría fallar la build con `DYNAMIC_SERVER_USAGE`.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  let nombre = "";
  try {
    // Mismo truco que el perfil de artista: una lectura REST barata solo para
    // el título, cacheada 5 min. Si falla, cae al título de marca.
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/colectivos/${slug}`,
      { next: { revalidate: 300 } },
    );
    if (res.ok) {
      const fields = (await res.json())?.fields ?? {};
      nombre = fields.nombre?.stringValue ?? "";
    }
  } catch {
    /* sin red o sin colectivo: título de marca */
  }
  const t = await getTranslations({ locale, namespace: "colectivos" });
  return {
    title: nombre ? `${nombre} — Only G Music` : `${t("title")} — Only G Music`,
    alternates: alternatesFor(locale, `/colectivos/${slug}`),
  };
}

export default async function ColectivoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ColectivoLoader slug={slug} />;
}
