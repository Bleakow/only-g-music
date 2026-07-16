"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { listAllQuotes } from "@/features/quotes/lib/quotes-repo";
import type { QuoteRequest } from "@only-g/shared-types/quote";
import { formatCOP } from "@only-g/shared-types/service";
import { badgeClass, fechaCorta } from "@/features/solicitudes/lib/estados";
import { glassSurface, GlassSheen } from "@/components/ui/glass";
import { Skeleton } from "@/components/ui/Skeleton";

/** Lista de solicitudes de cotización para el admin (dentro del shell del panel). */
export function AdminCotizaciones() {
  const t = useTranslations();
  const locale = useLocale();
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listAllQuotes()
      .then((q) => {
        if (!active) return;
        setQuotes(q);
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="px-6 pt-20 pb-16 sm:px-10 sm:pt-24">
      <p className="text-amethyst-300 text-xs font-semibold tracking-[4px] uppercase">
        {t("adminDashboard.eyebrow")}
      </p>
      <h1 className="font-narrow mt-2 text-4xl font-bold uppercase sm:text-5xl">
        {t("adminNav.cotizaciones")}
      </h1>

      {loading ? (
        <ul className="mt-8 flex flex-col gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className={`${glassSurface} relative flex items-center gap-3 overflow-hidden rounded-xl p-4`}
            >
              <span className="relative min-w-0 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </span>
              <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      ) : quotes.length === 0 ? (
        <p className="text-silver-400 mt-8">{t("adminDashboard.noQuotes")}</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-2.5">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link
                href={`/admin/cotizacion/${q.id}`}
                className={`${glassSurface} relative flex items-center gap-3 overflow-hidden rounded-xl p-4 transition hover:bg-white/5`}
              >
                <GlassSheen />
                <span className="relative min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">
                    {q.contactName} ·{" "}
                    {q.items.map((i) => i.serviceName).join(", ")}
                  </span>
                  <span className="text-silver-400 block truncate text-xs">
                    {fechaCorta(q.createdAt, locale)} ·{" "}
                    {formatCOP(q.estimatedTotal ?? 0)}
                  </span>
                </span>
                <span
                  className={`relative shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${badgeClass(q.status)}`}
                >
                  {t(`status.${q.status}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
