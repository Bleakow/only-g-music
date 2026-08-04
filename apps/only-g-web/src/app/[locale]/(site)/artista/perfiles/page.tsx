import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { PerfilesConvenios } from "@/features/artists/components/artes/PerfilesConvenios";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "perfilesConvenios" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * "Perfiles y convenios". Solo exige sesión: se puede elegir qué artes manejas
 * ANTES de tener perfil creado (los roles viven en la cuenta, no en el perfil).
 */
export default async function PerfilesConveniosPage() {
  const t = await getTranslations("guards");
  return (
    <RequireAuth title={t("artistTitle")} message={t("artistEditMessage")}>
      <PerfilesConvenios />
    </RequireAuth>
  );
}
