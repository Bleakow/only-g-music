"use client";

import { useTranslations } from "next-intl";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { SolicitudesList } from "@/features/solicitudes/components/SolicitudesList";
import { CatalogBackground } from "@/features/services/components/CatalogBackground";
import {
  MIS_COSAS_BG_DESKTOP,
  MIS_COSAS_BG_MOBILE,
} from "@/features/services/data/services";

export default function SolicitudesPage() {
  const t = useTranslations("guards");
  return (
    <RequireAuth
      title={t("requestsTitle")}
      message={t("requestsMessage")}
    >
      <CatalogBackground
        desktop={MIS_COSAS_BG_DESKTOP}
        mobile={MIS_COSAS_BG_MOBILE}
      >
        <SolicitudesList />
      </CatalogBackground>
    </RequireAuth>
  );
}
