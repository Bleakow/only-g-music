"use client";

import { useTranslations } from "next-intl";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminGastos } from "@/features/admin/components/AdminGastos";

export default function AdminGastosPage() {
  const t = useTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("expensesTitle")}
      message={t("adminMessage")}
    >
      <AdminGastos />
    </RequireRole>
  );
}
