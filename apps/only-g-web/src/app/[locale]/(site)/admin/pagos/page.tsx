import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminPagos } from "@/features/admin/components/AdminPagos";

export default async function AdminPagosPage() {
  const t = await getTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("adminTitle")}
      message={t("adminMessage")}
    >
      <AdminPagos />
    </RequireRole>
  );
}
