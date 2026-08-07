import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { BookEditor } from "@/features/book/components/BookEditor";

/**
 * Book de CUALQUIER perfil, montado por el admin (§10). Hermana de
 * `/admin/perfiles/[slug]/editar`, y necesaria por lo mismo: los perfiles con
 * etiqueta `modelo` son de convenio y muchos son MOCK (sin cuenta dueña), así
 * que alguien tiene que poder montarles el book — y ese alguien no puede ser
 * `/artista/book`, que edita el del usuario logueado.
 */
export default async function AdminBookPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("profilesTitle")}
      message={t("adminMessage")}
    >
      <BookEditor slugOverride={slug} adminMode />
    </RequireRole>
  );
}
