"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { listQuotesByUser } from "@/features/quotes/lib/quotes-repo";
import { listReservasByUser } from "@/features/booking/lib/booking-repo";
import type { QuoteRequest } from "@only-g/shared-types/quote";
import type { Reserva } from "@only-g/shared-types/booking";
import { formatCOP } from "@only-g/shared-types/service";
import { badgeClass, fechaCorta } from "../lib/estados";
import { Skeleton } from "@/components/ui/Skeleton";

function Badge({ estado, label }: { estado: string; label: string }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${badgeClass(estado)}`}
    >
      {label}
    </span>
  );
}

function ReservaCard({
  r,
  locale,
  statusLabel,
}: {
  r: Reserva;
  locale: string;
  statusLabel: string;
}) {
  // Las citas tienen `start` real; las producciones (sin slot) caen a createdAt.
  const fecha = r.start > 0 ? r.start : r.createdAt;
  return (
    <li>
      <Link
        href={`/solicitudes/reserva/${r.id}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25"
      >
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{r.serviceName}</p>
          <p className="text-silver-400 text-sm">
            {fechaCorta(fecha, locale)} · {formatCOP(r.amount ?? 0)}
          </p>
        </div>
        <Badge estado={r.estado} label={statusLabel} />
      </Link>
    </li>
  );
}

export function SolicitudesList() {
  const { user } = useAuth();
  const t = useTranslations();
  const locale = useLocale();
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    Promise.all([listQuotesByUser(user.uid), listReservasByUser(user.uid)])
      .then(([q, r]) => {
        if (!active) return;
        setQuotes(q);
        setReservas(r);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[solicitudes] error:", e);
        setError(t("solicitudes.loadError"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, t]);

  // Citas = sesiones de estudio (con fecha real), próximas primero.
  const citas = reservas
    .filter((r) => r.tipo === "sesion" || !r.tipo)
    .sort((a, b) => b.start - a.start);
  // Todo lo demás (producciones de proyecto + compras de perfil) va al catch-all.
  const producciones = reservas.filter((r) => r.tipo !== "sesion" && !!r.tipo);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 pt-28 pb-24 sm:px-12">
      <h1 className="font-narrow text-5xl font-bold uppercase sm:text-6xl">
        {t("userMenu.myRequests")}
      </h1>
      <p className="text-silver-300 mt-2">{t("solicitudes.intro")}</p>

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-10 flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Mis citas (sesiones agendadas) */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold text-white uppercase">
              {t("solicitudes.citas")}
            </h2>
            {citas.length === 0 ? (
              <p className="text-silver-400 mt-2">
                {t("solicitudes.noCitas")}{" "}
                <Link
                  href="/servicios"
                  className="text-amethyst-300 underline-offset-4 hover:underline"
                >
                  {t("solicitudes.seeServices")}
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {citas.map((r) => (
                  <ReservaCard
                    key={r.id}
                    r={r}
                    locale={locale}
                    statusLabel={t(`status.${r.estado}`)}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Producciones y demás reservas */}
          {producciones.length > 0 && (
            <section className="mt-10">
              <h2 className="font-narrow text-2xl font-bold text-white uppercase">
                {t("solicitudes.bookings")}
              </h2>
              <ul className="mt-4 flex flex-col gap-3">
                {producciones.map((r) => (
                  <ReservaCard
                    key={r.id}
                    r={r}
                    locale={locale}
                    statusLabel={t(`status.${r.estado}`)}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* Cotizaciones */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold text-white uppercase">
              {t("solicitudes.quotes")}
            </h2>
            {quotes.length === 0 ? (
              <p className="text-silver-400 mt-2">
                {t("solicitudes.noQuotes")}{" "}
                <Link
                  href="/cotizar"
                  className="text-amethyst-300 underline-offset-4 hover:underline"
                >
                  {t("solicitudes.requestOne")}
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {quotes.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/solicitudes/cotizacion/${q.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {q.items.map((i) => i.serviceName).join(", ") ||
                            t("solicitudes.quoteFallback")}
                        </p>
                        <p className="text-silver-400 text-sm">
                          {fechaCorta(q.createdAt, locale)}
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
