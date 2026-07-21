"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { CompraWizard } from "@/features/pedidos/components/CompraWizard";
import { CatalogBackground } from "@/features/services/components/CatalogBackground";

export default function ComprarPage() {
  const t = useTranslations("guards");
  return (
    <RequireAuth title={t("buyTitle")} message={t("buyMessage")}>
      <CatalogBackground>
        <Suspense fallback={<main className="min-h-dvh bg-ink" />}>
          <CompraWizard />
        </Suspense>
      </CatalogBackground>
    </RequireAuth>
  );
}
