import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminRoles } from "@/features/admin/components/AdminRoles";

export default async function AdminRolesPage() {
  const t = await getTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("rolesTitle")}
      message={t("adminMessage")}
    >
      <AdminRoles />
    </RequireRole>
  );
}
