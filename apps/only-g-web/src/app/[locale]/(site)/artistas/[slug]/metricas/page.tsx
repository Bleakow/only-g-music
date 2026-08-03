import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MetricsLoader } from "@/features/artists/components/metrics/MetricsLoader";

/**
 * Panel de métricas del perfil (§04). Dinámica por el mismo motivo que el perfil:
 * los datos se piden en cliente (con el ID token de la sesión), así que no hay
 * nada que prerenderizar — y `generateStaticParams` marcaría la ruta como SSG y
 * reventaría en producción con `DYNAMIC_SERVER_USAGE`.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metrics" });
  return {
    title: t("title"),
    // Las métricas no son contenido público que deba indexarse, ni siquiera
    // cuando el artista las comparte: el buscador no debe filtrar un enlace
    // privado a los resultados.
    robots: { index: false, follow: false },
  };
}

export default async function MetricasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { slug } = await params;
  const { k } = await searchParams;
  return <MetricsLoader slug={slug} token={k} />;
}
