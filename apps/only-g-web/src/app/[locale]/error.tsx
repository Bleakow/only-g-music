"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { logError } from "@/features/observability/lib/error-log";

/**
 * Límite de error de la ruta (App Router). Captura los errores de render del
 * árbol de páginas, los registra y ofrece reintentar. El layout (con el proveedor
 * de i18n) sigue montado, por eso `useTranslations` funciona aquí.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    logError(error, "route-error-boundary");
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="font-narrow text-4xl font-bold uppercase text-white sm:text-5xl">
        {t("title")}
      </h1>
      <p className="text-silver-300">{t("message")}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-6 py-2.5 text-sm font-semibold text-ink transition hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]"
      >
        {t("retry")}
      </button>
    </main>
  );
}
