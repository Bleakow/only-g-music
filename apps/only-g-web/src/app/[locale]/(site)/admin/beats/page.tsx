import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminPayouts } from "@/features/admin/components/AdminPayouts";

export default async function AdminBeatsPage() {
  const t = await getTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("payoutsTitle")}
      message={t("adminMessage")}
    >
      <AdminPayouts />
    </RequireRole>
  );
}
