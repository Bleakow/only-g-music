import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { ProfileBuilder } from "@/features/artists/components/profile/ProfileBuilder";

// Edición de CUALQUIER perfil por el admin (modo admin del editor): edita por
// slug y oculta el flujo de pago/publicación. La membresía se gestiona desde la
// grilla de admin, no aquí.
export default async function AdminEditarPerfilPage({
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
      <ProfileBuilder slugOverride={slug} adminMode />
    </RequireRole>
  );
}
