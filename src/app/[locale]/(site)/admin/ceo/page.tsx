"use client";

import { useTranslations } from "next-intl";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { CeoConfig } from "@/features/ceo/components/CeoConfig";

/**
 * Herramienta del CEO (config comercial). Vive bajo /admin (hereda el shell del
 * panel), pero se gatea por rol `ceo`, NO `admin`: un admin NO ve ni edita
 * comisiones/precios. El layout de /admin ya exige admin (el CEO lo hereda por
 * convención al llevar ['admin','ceo']); este guard restringe la config al CEO.
 */
export default function AdminCeoPage() {
  const t = useTranslations("guards");
  return (
    <RequireRole
      roles={["ceo"]}
      title={t("ceoTitle")}
      message={t("ceoMessage")}
    >
      <CeoConfig />
    </RequireRole>
  );
}
