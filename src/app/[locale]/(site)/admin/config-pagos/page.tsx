"use client";

import { useTranslations } from "next-intl";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminConfigPagos } from "@/features/admin/components/AdminConfigPagos";

export default function AdminConfigPagosPage() {
  const t = useTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("paymentsConfigTitle")}
      message={t("adminMessage")}
    >
      <AdminConfigPagos />
    </RequireRole>
  );
}
