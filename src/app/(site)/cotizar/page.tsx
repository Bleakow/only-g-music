"use client";

import { Suspense } from "react";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { QuoteWizard } from "@/features/quotes/components/QuoteWizard";

export default function CotizarPage() {
  return (
    <RequireAuth
      title="Inicia sesión para cotizar"
      message="Necesitas una cuenta para solicitar una cotización de producción."
    >
      <Suspense fallback={<main className="min-h-dvh bg-ink" />}>
        <QuoteWizard />
      </Suspense>
    </RequireAuth>
  );
}
