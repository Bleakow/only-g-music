"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { QuoteWizard } from "@/features/quotes/components/QuoteWizard";

export default function CotizarPage() {
  const t = useTranslations("guards");
  return (
    <RequireAuth
      title={t("quoteTitle")}
      message={t("quoteMessage")}
    >
      <Suspense fallback={<main className="min-h-dvh bg-ink" />}>
        <QuoteWizard />
      </Suspense>
    </RequireAuth>
  );
}
