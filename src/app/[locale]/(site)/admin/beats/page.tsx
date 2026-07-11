import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminBeatsPayouts } from "@/features/admin/components/AdminBeatsPayouts";

export default async function AdminBeatsPage() {
  const t = await getTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("beatsTitle")}
      message={t("adminMessage")}
    >
      <AdminBeatsPayouts />
    </RequireRole>
  );
}
