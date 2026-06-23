"use client";

import { useTranslations } from "next-intl";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminDashboard } from "@/features/admin/components/AdminDashboard";

export default function AdminPage() {
  const t = useTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("adminTitle")}
      message={t("adminMessage")}
    >
      <AdminDashboard />
    </RequireRole>
  );
}
