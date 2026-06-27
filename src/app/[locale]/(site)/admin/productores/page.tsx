import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminProductores } from "@/features/admin/components/AdminProductores";

export default async function AdminProductoresPage() {
  const t = await getTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("productoresTitle")}
      message={t("adminMessage")}
    >
      <AdminProductores />
    </RequireRole>
  );
}
