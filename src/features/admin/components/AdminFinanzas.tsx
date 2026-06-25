"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { listAllBookings } from "@/features/booking/lib/booking-repo";
import { listTransactions } from "../lib/transactions-repo";
import type { Transaccion } from "@/domain/transaccion";
import { formatCOP } from "@/domain/service";
import {
  ingresoTotal,
  ingresosPorMes,
  mejoresClientes,
  reservasATransacciones,
  ordenarTransacciones,
} from "../lib/finanzas";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import { listMovimientos } from "../lib/movimientos-repo";
import type { Movimiento } from "@/domain/contabilidad";
import { EstadoResultados } from "./EstadoResultados";

function mesLabel(mes: string, locale: string): string {
  const [y, m] = mes.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(date);
}

export function AdminFinanzas() {
  const t = useTranslations();
  const locale = useLocale();
  const [txs, setTxs] = useState<Transaccion[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listAllBookings(), listTransactions(), listMovimientos()])
      .then(([bookings, transactions, movs]) => {
        if (!active) return;
        setTxs(
          ordenarTransacciones([
            ...reservasATransacciones(bookings),
            ...transactions,
          ]),
        );
        setMovimientos(movs);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[finanzas] error:", e);
        setError(t("adminFinanzas.loadError"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const total = ingresoTotal(txs);
  const porMes = ingresosPorMes(txs);
  const top = mejoresClientes(txs);
  const maxMes = Math.max(1, ...porMes.map((m) => m.total));

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 pb-24 pt-28 sm:px-12">
      <Link
        href="/admin"
        className="text-sm text-silver-300 underline-offset-4 hover:text-white hover:underline"
      >
        {t("adminFinanzas.backToAdmin")}
      </Link>
      <h1 className="mt-4 font-narrow text-5xl font-bold uppercase sm:text-6xl">
        {t("adminFinanzas.title")}
      </h1>
      <p className="mt-2 text-silver-300">
        {t("adminFinanzas.intro")}
      </p>

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-silver-300">{t("common.loading")}</p>
      ) : (
        <>
          {/* Total */}
          <div className="mt-8 rounded-2xl border border-amethyst-300/30 bg-amethyst-500/10 p-6">
            <p className="text-xs uppercase tracking-[2px] text-amethyst-200">
              {t("adminFinanzas.totalLabel")}
            </p>
            <p className="mt-1 font-narrow text-4xl font-bold text-white sm:text-5xl">
              {formatCOP(total)}
            </p>
            <p className="mt-1 text-sm text-silver-400">
              {t("adminFinanzas.transactionCount", { count: txs.length })}
            </p>
          </div>

          {/* Estado de resultados (P&L) */}
          <EstadoResultados txs={txs} movimientos={movimientos} />

          {/* Ingresos por mes */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold uppercase text-white">
              {t("adminFinanzas.revenueByMonth")}
            </h2>
            {porMes.length === 0 ? (
              <p className="mt-2 text-silver-400">{t("adminFinanzas.noRevenue")}</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {porMes.map((m) => (
                  <div key={m.mes} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-sm text-silver-300">
                      {mesLabel(m.mes, locale)}
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
              {t("adminFinanzas.topClients")}
            </h2>
            {top.length === 0 ? (
              <p className="mt-2 text-silver-400">{t("adminFinanzas.noClients")}</p>
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
                        {t("adminFinanzas.bookingCount", { count: c.count })}
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
              {t("adminFinanzas.transactions")}
            </h2>
            {txs.length === 0 ? (
              <p className="mt-2 text-silver-400">{t("adminFinanzas.noTransactions")}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-silver-400">
                    <tr>
                      <th className="px-4 py-3">{t("adminFinanzas.colClient")}</th>
                      <th className="px-4 py-3">{t("adminFinanzas.colService")}</th>
                      <th className="px-4 py-3">{t("adminFinanzas.colDate")}</th>
                      <th className="px-4 py-3 text-right">{t("adminFinanzas.colAmount")}</th>
                      <th className="px-4 py-3">{t("adminFinanzas.colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {txs.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-4 py-3 text-silver-100">
                          {tx.clientName ?? t("adminFinanzas.clientFallback")}
                        </td>
                        <td className="px-4 py-3 text-silver-300">
                          {tx.concepto}
                        </td>
                        <td className="px-4 py-3 text-silver-400">
                          {fechaCorta(tx.fecha, locale)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                          {formatCOP(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-silver-300">
                          {t(`status.${tx.estado}`)}
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
