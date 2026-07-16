"use client";

import { useTranslations } from "next-intl";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminEstudios } from "@/features/admin/components/AdminEstudios";

export default function AdminEstudiosPage() {
  const t = useTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("estudiosTitle")}
      message={t("adminMessage")}
    >
      <AdminEstudios />
    </RequireRole>
  );
}
