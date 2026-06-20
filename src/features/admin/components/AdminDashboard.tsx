"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAllQuotes } from "@/features/quotes/lib/quotes-repo";
import { listAllBookings } from "@/features/booking/lib/booking-repo";
import type { QuoteRequest } from "@/domain/quote";
import type { Reserva } from "@/domain/booking";
import { formatCOP } from "@/domain/service";
import {
  QUOTE_LABEL,
  RESERVA_LABEL,
  badgeClass,
  fechaCorta,
} from "@/features/solicitudes/lib/estados";

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
        setError("No se pudieron cargar las solicitudes (¿tienes rol admin y reglas desplegadas?).");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const pendientesQuotes = quotes.filter((q) => q.status === "pendiente").length;
  const pendientesPagos = reservas.filter(
    (r) => r.estado === "pago_en_revision",
  ).length;

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 pb-24 pt-28 sm:px-12">
      <p className="text-sm uppercase tracking-[4px] text-amethyst-300">Admin</p>
      <h1 className="mt-2 font-narrow text-5xl font-bold uppercase sm:text-6xl">
        Panel
      </h1>
      <p className="mt-3 text-silver-300">
        {pendientesQuotes} cotización{pendientesQuotes !== 1 ? "es" : ""} por
        responder · {pendientesPagos} pago{pendientesPagos !== 1 ? "s" : ""} por
        revisar.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/admin/finanzas"
          className="inline-flex rounded-full border border-amethyst-400/60 px-5 py-2.5 text-sm font-semibold uppercase tracking-[2px] text-amethyst-200 transition hover:border-amethyst-300 hover:bg-amethyst-500/10 hover:text-white"
        >
          Ver finanzas →
        </Link>
        <Link
          href="/admin/perfiles"
          className="inline-flex rounded-full border border-amethyst-400/60 px-5 py-2.5 text-sm font-semibold uppercase tracking-[2px] text-amethyst-200 transition hover:border-amethyst-300 hover:bg-amethyst-500/10 hover:text-white"
        >
          Perfiles →
        </Link>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-silver-300">Cargando…</p>
      ) : (
        <>
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold uppercase text-white">
              Reservas
            </h2>
            {reservas.length === 0 ? (
              <p className="mt-2 text-silver-400">Sin reservas todavía.</p>
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
                        <p className="text-sm text-silver-400">
                          {fechaCorta(r.start)} · {formatCOP(r.amount ?? 0)}
                        </p>
                      </div>
                      <Badge estado={r.estado} label={RESERVA_LABEL[r.estado]} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold uppercase text-white">
              Cotizaciones
            </h2>
            {quotes.length === 0 ? (
              <p className="mt-2 text-silver-400">Sin cotizaciones todavía.</p>
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
                        <p className="text-sm text-silver-400">
                          {fechaCorta(q.createdAt)} ·{" "}
                          {formatCOP(q.estimatedTotal ?? 0)}
                          {q.hasQuoteOnlyItems ? " + a cotizar" : ""}
                        </p>
                      </div>
                      <Badge estado={q.status} label={QUOTE_LABEL[q.status]} />
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
