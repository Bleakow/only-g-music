"use client";

import { useTranslations } from "next-intl";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AvailabilityEditor } from "@/features/availability/components/AvailabilityEditor";

export default function DisponibilidadPage() {
  const t = useTranslations("guards");
  return (
    <RequireRole
      roles={["productor", "admin"]}
      title={t("availabilityTitle")}
      message={t("availabilityMessage")}
    >
      <AvailabilityEditor />
    </RequireRole>
  );
}
