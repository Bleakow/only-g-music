"use client";

import { useTranslations } from "next-intl";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminFinanzas } from "@/features/admin/components/AdminFinanzas";

export default function AdminFinanzasPage() {
  const t = useTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("financesTitle")}
      message={t("adminMessage")}
    >
      <AdminFinanzas />
    </RequireRole>
  );
}
