import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminConvenios } from "@/features/admin/components/AdminConvenios";

export default async function AdminConveniosPage() {
  const t = await getTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("conveniosTitle")}
      message={t("adminMessage")}
    >
      <AdminConvenios />
    </RequireRole>
  );
}
