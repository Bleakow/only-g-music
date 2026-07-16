"use client";

import { useTranslations } from "next-intl";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminBalance } from "@/features/admin/components/AdminBalance";

export default function AdminBalancePage() {
  const t = useTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("balanceTitle")}
      message={t("adminMessage")}
    >
      <AdminBalance />
    </RequireRole>
  );
}
