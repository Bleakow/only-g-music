"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { listAllBookings } from "@/features/booking/lib/booking-repo";
import { listTransactions } from "../lib/transactions-repo";
import { listPayouts } from "../lib/payouts-repo";
import type { Transaccion } from "@/domain/transaccion";
import { formatCOP } from "@/domain/service";
import { GlassButton } from "@/components/ui/GlassButton";
import { ArrowRightIcon } from "./admin-icons";
import {
  ingresoTotal,
  ingresosPorMes,
  mejoresClientes,
  reservasATransacciones,
  netoProductorPorReserva,
  ordenarTransacciones,
} from "../lib/finanzas";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import { listMovimientos } from "../lib/movimientos-repo";
import type { Movimiento } from "@/domain/contabilidad";
import { EstadoResultados } from "./EstadoResultados";
import { AdminPageHeader, adminCard, adminInner } from "./admin-ui";
import { Skeleton } from "@/components/ui/Skeleton";

function mesLabel(mes: string, locale: string): string {
  const [y, m] = mes.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(date);
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
    Promise.all([
      listAllBookings(),
      listTransactions(),
      listMovimientos(),
      listPayouts(),
    ])
      .then(([bookings, transactions, movs, payouts]) => {
        if (!active) return;
        setTxs(
          ordenarTransacciones([
            ...reservasATransacciones(
              bookings,
              netoProductorPorReserva(payouts),
            ),
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
    <main className="pb-24">
      <AdminPageHeader
        eyebrow={t("adminDashboard.eyebrow")}
        title={t("adminFinanzas.title")}
        subtitle={t("adminFinanzas.intro")}
      >
        {/* Finanzas es la vista rápida; el acceso a la gestión contable completa
            (activos, pasivos, balance, export) ya no cabía en el dashboard, así
            que vive aquí. */}
        <div className="mt-6">
          <GlassButton href="/admin/contabilidad">
            {t("adminFinanzas.openContabilidad")}
            <ArrowRightIcon className="size-4" />
          </GlassButton>
        </div>
      </AdminPageHeader>

      <div className="px-6 sm:px-10">
        {error && (
          <p className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {loading ? (
          <>
            {/* Total (skeleton) */}
            <div className={`${adminCard} p-6`}>
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-2 h-10 w-48" />
              <Skeleton className="mt-2 h-4 w-40" />
            </div>

            {/* Estado de resultados (skeleton) */}
            <div className={`mt-10 ${adminCard} p-5`}>
              <Skeleton className="h-6 w-56" />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`rounded-xl p-4 ${adminInner}`}>
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="mt-2 h-6 w-24" />
                  </div>
                ))}
              </div>
            </div>

            {/* Ingresos por mes (skeleton) */}
            <section className={`mt-10 ${adminCard} p-5`}>
              <Skeleton className="h-6 w-48" />
              <div className="mt-4 flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-20 shrink-0" />
                    <Skeleton className="h-6 flex-1" />
                    <Skeleton className="h-4 w-24 shrink-0" />
                  </div>
                ))}
              </div>
            </section>

            {/* Tabla de transacciones (skeleton) */}
            <section className={`mt-10 ${adminCard} p-5`}>
              <Skeleton className="h-6 w-44" />
              <div className={`mt-4 overflow-hidden rounded-xl ${adminInner}`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="ml-auto h-4 w-24" />
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Total */}
            <div className={`${adminCard} p-6`}>
              <p className="text-amethyst-200 text-xs tracking-[2px] uppercase">
                {t("adminFinanzas.totalLabel")}
              </p>
              <p className="font-narrow mt-1 text-4xl font-bold text-white sm:text-5xl">
                {formatCOP(total)}
              </p>
              <p className="text-silver-400 mt-1 text-sm">
                {t("adminFinanzas.transactionCount", { count: txs.length })}
              </p>
            </div>

            {/* Estado de resultados (P&L) */}
            <EstadoResultados txs={txs} movimientos={movimientos} />

            {/* Ingresos por mes */}
            <section className={`mt-10 ${adminCard} p-5`}>
              <h2 className="font-narrow text-2xl font-bold text-white uppercase">
                {t("adminFinanzas.revenueByMonth")}
              </h2>
              {porMes.length === 0 ? (
                <p className="text-silver-400 mt-2">
                  {t("adminFinanzas.noRevenue")}
                </p>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  {porMes.map((m) => (
                    <div key={m.mes} className="flex items-center gap-3">
                      <span className="text-silver-300 w-20 shrink-0 text-sm">
                        {mesLabel(m.mes, locale)}
                      </span>
                      <div className="h-6 flex-1 overflow-hidden rounded bg-white/5">
                        <div
                          className="from-silver-100 to-amethyst-300 h-full rounded bg-gradient-to-r"
                          style={{ width: `${(m.total / maxMes) * 100}%` }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right text-sm font-semibold text-white tabular-nums">
                        {formatCOP(m.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Mejores clientes */}
            <section className={`mt-10 ${adminCard} p-5`}>
              <h2 className="font-narrow text-2xl font-bold text-white uppercase">
                {t("adminFinanzas.topClients")}
              </h2>
              {top.length === 0 ? (
                <p className="text-silver-400 mt-2">
                  {t("adminFinanzas.noClients")}
                </p>
              ) : (
                <ol className="mt-4 flex flex-col gap-2">
                  {top.map((c, i) => (
                    <li
                      key={c.uid}
                      className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 ${adminInner}`}
                    >
                      <span className="text-silver-100 min-w-0 truncate">
                        <span className="text-silver-500">{i + 1}.</span>{" "}
                        {c.name}{" "}
                        <span className="text-silver-400">
                          {t("adminFinanzas.bookingCount", { count: c.count })}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-white tabular-nums">
                        {formatCOP(c.total)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Tabla de transacciones */}
            <section className={`mt-10 ${adminCard} p-5`}>
              <h2 className="font-narrow text-2xl font-bold text-white uppercase">
                {t("adminFinanzas.transactions")}
              </h2>
              {txs.length === 0 ? (
                <p className="text-silver-400 mt-2">
                  {t("adminFinanzas.noTransactions")}
                </p>
              ) : (
                <div
                  className={`mt-4 overflow-x-auto rounded-xl ${adminInner}`}
                >
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead className="text-silver-400 text-xs tracking-wide uppercase">
                      <tr>
                        <th className="px-4 py-3">
                          {t("adminFinanzas.colClient")}
                        </th>
                        <th className="px-4 py-3">
                          {t("adminFinanzas.colService")}
                        </th>
                        <th className="px-4 py-3">
                          {t("adminFinanzas.colDate")}
                        </th>
                        <th className="px-4 py-3 text-right">
                          {t("adminFinanzas.colAmount")}
                        </th>
                        <th className="px-4 py-3">
                          {t("adminFinanzas.colStatus")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {txs.map((tx) => (
                        <tr key={tx.id}>
                          <td className="text-silver-100 px-4 py-3">
                            {tx.clientName ?? t("adminFinanzas.clientFallback")}
                          </td>
                          <td className="text-silver-300 px-4 py-3">
                            {tx.concepto}
                          </td>
                          <td className="text-silver-400 px-4 py-3">
                            {fechaCorta(tx.fecha, locale)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">
                            {formatCOP(tx.amount)}
                          </td>
                          <td className="text-silver-300 px-4 py-3">
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
      </div>
    </main>
  );
}
