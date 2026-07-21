"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { QuoteWizard } from "@/features/quotes/components/QuoteWizard";
import { CatalogBackground } from "@/features/services/components/CatalogBackground";

export default function CotizarPage() {
  const t = useTranslations("guards");
  return (
    <RequireAuth
      title={t("quoteTitle")}
      message={t("quoteMessage")}
    >
      <CatalogBackground>
        <Suspense fallback={<main className="min-h-dvh bg-ink" />}>
          <QuoteWizard />
        </Suspense>
      </CatalogBackground>
    </RequireAuth>
  );
}
