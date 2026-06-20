"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAllBookings } from "@/features/booking/lib/booking-repo";
import type { Reserva } from "@/domain/booking";
import { formatCOP } from "@/domain/service";
import {
  ingresoTotal,
  ingresosPorMes,
  mejoresClientes,
  reservasContables,
} from "../lib/finanzas";
import { RESERVA_LABEL, fechaCorta } from "@/features/solicitudes/lib/estados";

const MONTHS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
function mesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${y}`;
}

export function AdminFinanzas() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listAllBookings()
      .then((r) => {
        if (!active) return;
        setReservas(r);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[finanzas] error:", e);
        setError("No se pudieron cargar los datos (¿rol admin y reglas desplegadas?).");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const total = ingresoTotal(reservas);
  const porMes = ingresosPorMes(reservas);
  const top = mejoresClientes(reservas);
  const tx = reservasContables(reservas);
  const maxMes = Math.max(1, ...porMes.map((m) => m.total));

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 pb-24 pt-28 sm:px-12">
      <Link
        href="/admin"
        className="text-sm text-silver-300 underline-offset-4 hover:text-white hover:underline"
      >
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-narrow text-5xl font-bold uppercase sm:text-6xl">
        Finanzas
      </h1>
      <p className="mt-2 text-silver-300">
        Ingresos de reservas confirmadas. Derivados de las reservas (una sola
        fuente de verdad).
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
          {/* Total */}
          <div className="mt-8 rounded-2xl border border-amethyst-300/30 bg-amethyst-500/10 p-6">
            <p className="text-xs uppercase tracking-[2px] text-amethyst-200">
              Ingreso total confirmado
            </p>
            <p className="mt-1 font-narrow text-4xl font-bold text-white sm:text-5xl">
              {formatCOP(total)}
            </p>
            <p className="mt-1 text-sm text-silver-400">
              {tx.length} transacción{tx.length !== 1 ? "es" : ""}
            </p>
          </div>

          {/* Ingresos por mes */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold uppercase text-white">
              Ingresos por mes
            </h2>
            {porMes.length === 0 ? (
              <p className="mt-2 text-silver-400">Aún no hay ingresos.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {porMes.map((m) => (
                  <div key={m.mes} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-sm text-silver-300">
                      {mesLabel(m.mes)}
                    </span>
                    <div className="h-6 flex-1 overflow-hidden rounded bg-white/5">
                      <div
                        className="h-full rounded bg-gradient-to-r from-silver-100 to-amethyst-300"
                        style={{ width: `${(m.total / maxMes) * 100}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-white">
                      {formatCOP(m.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Mejores clientes */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold uppercase text-white">
              Mejores clientes
            </h2>
            {top.length === 0 ? (
              <p className="mt-2 text-silver-400">Aún no hay clientes.</p>
            ) : (
              <ol className="mt-4 flex flex-col gap-2">
                {top.map((c, i) => (
                  <li
                    key={c.uid}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <span className="min-w-0 truncate text-silver-100">
                      <span className="text-silver-500">{i + 1}.</span> {c.name}{" "}
                      <span className="text-silver-400">
                        ({c.count} reserva{c.count !== 1 ? "s" : ""})
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-white">
                      {formatCOP(c.total)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Tabla de transacciones */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold uppercase text-white">
              Transacciones
            </h2>
            {tx.length === 0 ? (
              <p className="mt-2 text-silver-400">Sin transacciones confirmadas.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-silver-400">
                    <tr>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Servicio</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {tx.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-silver-100">
                          {r.clientName ?? "Cliente"}
                        </td>
                        <td className="px-4 py-3 text-silver-300">
                          {r.serviceName}
                        </td>
                        <td className="px-4 py-3 text-silver-400">
                          {fechaCorta(r.start)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                          {formatCOP(r.amount ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-silver-300">
                          {RESERVA_LABEL[r.estado]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
