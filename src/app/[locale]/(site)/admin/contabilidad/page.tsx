import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminContabilidad } from "@/features/admin/components/AdminContabilidad";

export default async function AdminContabilidadPage() {
  const t = await getTranslations("guards");
  return (
    <RequireRole roles={["admin"]} title={t("adminTitle")}>
      <AdminContabilidad />
    </RequireRole>
  );
}
