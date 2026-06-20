"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { listQuotesByUser } from "@/features/quotes/lib/quotes-repo";
import { listReservasByUser } from "@/features/booking/lib/booking-repo";
import type { QuoteRequest } from "@/domain/quote";
import type { Reserva } from "@/domain/booking";
import { formatCOP } from "@/domain/service";
import { QUOTE_LABEL, RESERVA_LABEL, badgeClass, fechaCorta } from "../lib/estados";

function Badge({ estado, label }: { estado: string; label: string }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${badgeClass(estado)}`}
    >
      {label}
    </span>
  );
}

export function SolicitudesList() {
  const { user } = useAuth();
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
        setError(
          "No se pudieron cargar tus solicitudes. Si es la primera vez, Firestore puede pedir crear un índice (revisa la consola del navegador para el enlace).",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-28 sm:px-12">
      <h1 className="font-narrow text-5xl font-bold uppercase sm:text-6xl">
        Mis solicitudes
      </h1>
      <p className="mt-2 text-silver-300">
        Tus reservas y cotizaciones, con su estado y su chat con el estudio.
      </p>

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-silver-300">Cargando…</p>
      ) : (
        <>
          {/* Reservas */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold uppercase text-white">
              Reservas
            </h2>
            {reservas.length === 0 ? (
              <p className="mt-2 text-silver-400">
                Aún no tienes reservas.{" "}
                <Link
                  href="/servicios"
                  className="text-amethyst-300 underline-offset-4 hover:underline"
                >
                  Ver servicios
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {reservas.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/solicitudes/reserva/${r.id}`}
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

          {/* Cotizaciones */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold uppercase text-white">
              Cotizaciones
            </h2>
            {quotes.length === 0 ? (
              <p className="mt-2 text-silver-400">
                Aún no tienes cotizaciones.{" "}
                <Link
                  href="/cotizar"
                  className="text-amethyst-300 underline-offset-4 hover:underline"
                >
                  Solicitar una
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
                            "Cotización"}
                        </p>
                        <p className="text-sm text-silver-400">
                          {fechaCorta(q.createdAt)}
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
