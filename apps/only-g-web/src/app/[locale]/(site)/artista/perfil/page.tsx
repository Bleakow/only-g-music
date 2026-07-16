import { getTranslations } from "next-intl/server";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { ProfileBuilder } from "@/features/artists/components/profile/ProfileBuilder";

// Solo exige sesión: el artista puede construir su BORRADOR antes de que el
// estudio le active el rol/premium ("borrador sin rol"). ProfileBuilder hace de
// guard real — si no tienes alta (artistSlug), te manda a crearla.
export default async function ProfileBuilderPage() {
  const t = await getTranslations("guards");
  return (
    <RequireAuth
      title={t("artistTitle")}
      message={t("artistEditMessage")}
    >
      <ProfileBuilder />
    </RequireAuth>
  );
}
