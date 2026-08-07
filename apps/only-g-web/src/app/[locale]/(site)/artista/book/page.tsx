import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { BookEditor } from "@/features/book/components/BookEditor";

/**
 * Editor del BOOK (§10). Pantalla propia y no otro bloque dentro de
 * `ProfileBuilder`: ese archivo ya pasa de dos mil líneas, y el book tiene su
 * propio documento, su propio guardado y su propio "publicado".
 *
 * El guardarraíl de verdad (¿tienes perfil? ¿tienes la sección encendida?) lo
 * hace el propio editor, igual que hace el de perfil: aquí solo se exige sesión.
 *
 * SIN `force-dynamic`, a diferencia de la ruta pública del book. Esta no lleva
 * `[slug]`: es una cáscara por idioma que Next prerenderiza y cuyo contenido
 * monta el cliente, igual que `/artista/perfil` y `/artista/perfiles`. Se probó
 * a declararlo y el build lo sigue sacando como estática (`●`), o sea que era
 * una declaración que no hacía nada y contradecía a sus rutas hermanas.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bookEditor" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default async function BookEditorPage() {
  const t = await getTranslations("guards");
  return (
    <RequireAuth title={t("artistTitle")} message={t("artistEditMessage")}>
      <BookEditor />
    </RequireAuth>
  );
}
