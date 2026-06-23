import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminPerfiles } from "@/features/admin/components/AdminPerfiles";

export default async function AdminPerfilesPage() {
  const t = await getTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("profilesTitle")}
      message={t("adminMessage")}
    >
      <AdminPerfiles />
    </RequireRole>
  );
}
