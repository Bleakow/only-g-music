import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getArtisticName } from "@/lib/artist-name";
import { BookLoader } from "@/features/book/components/BookLoader";

/**
 * EL BOOK (§10) — portafolio inmersivo de un perfil de modelo.
 *
 * Ruta propia y no un modal sobre el perfil, por tres motivos que pesan: se
 * COMPARTE (es el enlace que una modelo le manda a un cliente, y un modal no
 * tiene URL), puede ocupar la pantalla entera sin pelearse con el header del
 * sitio, y su coreografía —GSAP y sus plugins— no engorda el bundle del perfil.
 *
 * `force-dynamic` por el mismo motivo que el perfil y las métricas: los datos se
 * piden en cliente, así que no hay nada que prerenderizar, y declarar
 * `generateStaticParams` marcaría la ruta como SSG y reventaría en producción
 * con `DYNAMIC_SERVER_USAGE`.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const [name, t] = await Promise.all([
    getArtisticName(slug),
    getTranslations({ locale, namespace: "book" }),
  ]);
  return {
    title: name ? t("metaTitle", { name }) : t("metaTitleFallback"),
    // El book vive del perfil: que el buscador mande a la gente al perfil, que es
    // donde están el contexto y los datos de contacto, y no a una galería suelta
    // que compite con él por el mismo nombre.
    robots: { index: false, follow: true },
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <BookLoader slug={slug} />;
}
