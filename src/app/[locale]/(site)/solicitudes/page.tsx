"use client";

import { useTranslations } from "next-intl";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { SolicitudesList } from "@/features/solicitudes/components/SolicitudesList";

export default function SolicitudesPage() {
  const t = useTranslations("guards");
  return (
    <RequireAuth
      title={t("requestsTitle")}
      message={t("requestsMessage")}
    >
      <SolicitudesList />
    </RequireAuth>
  );
}
