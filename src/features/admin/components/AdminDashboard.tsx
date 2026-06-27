"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { listAllQuotes } from "@/features/quotes/lib/quotes-repo";
import { listAllBookings } from "@/features/booking/lib/booking-repo";
import type { QuoteRequest } from "@/domain/quote";
import type { Reserva } from "@/domain/booking";
import { formatCOP } from "@/domain/service";
import { badgeClass, fechaCorta } from "@/features/solicitudes/lib/estados";

function Badge({ estado, label }: { estado: string; label: string }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${badgeClass(estado)}`}
    >
      {label}
    </span>
  );
}

export function AdminDashboard() {
  const t = useTranslations();
  const locale = useLocale();

  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listAllQuotes(), listAllBookings()])
      .then(([q, r]) => {
        if (!active) return;
        setQuotes(q);
        setReservas(r);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[admin] error:", e);
        setError(t("adminDashboard.loadError"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const pendientesQuotes = quotes.filter(
    (q) => q.status === "pendiente",
  ).length;
  const pendientesPagos = reservas.filter(
    (r) => r.estado === "pago_en_revision",
  ).length;

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 pt-28 pb-24 sm:px-12">
      <p className="text-amethyst-300 text-sm tracking-[4px] uppercase">
        {t("adminDashboard.eyebrow")}
      </p>
      <h1 className="font-narrow mt-2 text-5xl font-bold uppercase sm:text-6xl">
        {t("adminDashboard.title")}
      </h1>
      <p className="text-silver-300 mt-3">
        {t("adminDashboard.summary", {
          quotesCount: pendientesQuotes,
          paymentsCount: pendientesPagos,
        })}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/admin/finanzas"
          className="border-amethyst-400/60 text-amethyst-200 hover:border-amethyst-300 hover:bg-amethyst-500/10 inline-flex rounded-full border px-5 py-2.5 text-sm font-semibold tracking-[2px] uppercase transition hover:text-white"
        >
          {t("adminDashboard.viewFinances")}
        </Link>
        <Link
          href="/admin/perfiles"
          className="border-amethyst-400/60 text-amethyst-200 hover:border-amethyst-300 hover:bg-amethyst-500/10 inline-flex rounded-full border px-5 py-2.5 text-sm font-semibold tracking-[2px] uppercase transition hover:text-white"
        >
          {t("adminDashboard.viewProfiles")}
        </Link>
        <Link
          href="/admin/contabilidad"
          className="border-amethyst-400/60 text-amethyst-200 hover:border-amethyst-300 hover:bg-amethyst-500/10 inline-flex rounded-full border px-5 py-2.5 text-sm font-semibold tracking-[2px] uppercase transition hover:text-white"
        >
          {t("adminDashboard.viewAccounting")}
        </Link>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-silver-300 mt-10">{t("common.loading")}</p>
      ) : (
        <>
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold text-white uppercase">
              {t("adminDashboard.bookings")}
            </h2>
            {reservas.length === 0 ? (
              <p className="text-silver-400 mt-2">
                {t("adminDashboard.noBookings")}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {reservas.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/reserva/${r.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {r.serviceName}
                        </p>
                        <p className="text-silver-400 text-sm">
                          {fechaCorta(r.start, locale)} ·{" "}
                          {formatCOP(r.amount ?? 0)}
                        </p>
                      </div>
                      <Badge
                        estado={r.estado}
                        label={t(`status.${r.estado}`)}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold text-white uppercase">
              {t("adminDashboard.quotes")}
            </h2>
            {quotes.length === 0 ? (
              <p className="text-silver-400 mt-2">
                {t("adminDashboard.noQuotes")}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {quotes.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/admin/cotizacion/${q.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {q.contactName} ·{" "}
                          {q.items.map((i) => i.serviceName).join(", ")}
                        </p>
                        <p className="text-silver-400 text-sm">
                          {fechaCorta(q.createdAt, locale)} ·{" "}
                          {formatCOP(q.estimatedTotal ?? 0)}
                          {q.hasQuoteOnlyItems
                            ? ` + ${t("solicitudDetail.toQuote")}`
                            : ""}
                        </p>
                      </div>
                      <Badge
                        estado={q.status}
                        label={t(`status.${q.status}`)}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
