"use client";

import { useTranslations } from "next-intl";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminBienes } from "@/features/admin/components/AdminBienes";

export default function AdminBienesPage() {
  const t = useTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("assetsTitle")}
      message={t("adminMessage")}
    >
      <AdminBienes />
    </RequireRole>
  );
}
