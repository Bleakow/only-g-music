"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpinnerIcon } from "@/components/icons";
import type { BeatSale } from "@only-g/shared-types/beat-sale";
import { formatCOP } from "@only-g/shared-types/service";
import {
  listBeatSales,
  marcarPayoutPagado,
} from "@/features/beats/lib/beat-sales-repo";
import { backfillPayouts } from "@/features/admin/lib/payouts-repo";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import { AdminPageHeader, adminCard, adminInner } from "./admin-ui";

/**
 * Panel admin de VENTAS y PAYOUTS de beats: separa lo pendiente de pago
 * (arriba, con botón de acción) de lo ya pagado (abajo, atenuado). Marcar un
 * payout como pagado es una transferencia MANUAL al beatmaker (fuera de la
 * app) — la escritura pasa por la Cloud Function callable `marcarBeatPayout`
 * (`beatSales` no admite escritura directa desde el cliente), con update
 * optimista aquí para que la fila salte de sección al instante.
 */
export function AdminBeatsPayouts() {
  const t = useTranslations();
  const locale = useLocale();

  const [sales, setSales] = useState<BeatSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listBeatSales()
      .then((list) => {
        if (!active) return;
        setSales(list);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[admin-beats-payouts] load:", e);
        setError(t("adminBeats.errorCargar"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const pendientes = sales.filter((s) => !s.paidOut);
  const pagadas = sales.filter((s) => s.paidOut);

  // Memoiza sobre `sales` (no sobre `pendientes`, que se recrea en cada
  // render): filtrar ahí adentro es lo que hace que el memo sirva de algo.
  const totalPendiente = useMemo(
    () => sales.filter((s) => !s.paidOut).reduce((sum, s) => sum + s.neto, 0),
    [sales],
  );

  // Backfill (one-shot): siembra `payouts` desde las ventas históricas aún no
  // pagadas. Idempotente en el servidor → se puede pulsar sin miedo a duplicar.
  async function sincronizarPayouts() {
    if (backfilling) return;
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const count = await backfillPayouts();
      setBackfillMsg(t("adminBeats.backfillDone", { count }));
    } catch (e) {
      console.error("[admin-beats-payouts] backfill:", e);
      setBackfillMsg(t("adminBeats.backfillError"));
    } finally {
      setBackfilling(false);
    }
  }

  async function marcarPagado(sale: BeatSale) {
    if (payingId) return;
    setPayingId(sale.id);
    setError(null);
    try {
      await marcarPayoutPagado(sale.id);
      setSales((prev) =>
        prev.map((s) =>
          s.id === sale.id ? { ...s, paidOut: true, paidOutAt: Date.now() } : s,
        ),
      );
    } catch (e) {
      console.error("[admin-beats-payouts] marcarPagado:", e);
      setError(t("adminBeats.errorPagar"));
    } finally {
      setPayingId(null);
    }
  }

  return (
    <main className="pb-24">
      <AdminPageHeader
        eyebrow={t("adminDashboard.eyebrow")}
        title={t("adminBeats.title")}
        subtitle={t("adminBeats.intro")}
      >
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <GlassButton onClick={sincronizarPayouts} disabled={backfilling}>
            {backfilling && <SpinnerIcon className="size-4 animate-spin" />}
            {t("adminBeats.backfill")}
          </GlassButton>
          {backfillMsg && (
            <span className="text-silver-300 text-sm">{backfillMsg}</span>
          )}
        </div>
      </AdminPageHeader>

      <div className="px-6 sm:px-10">
        {error && (
          <Alert tone="error" className="mb-6">
            {error}
          </Alert>
        )}

        {loading ? (
          <div className={`${adminCard} p-5`}>
            <ul className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <li
                  key={i}
                  className={`flex items-center justify-between gap-3 rounded-xl p-3 ${adminInner}`}
                >
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
                </li>
              ))}
            </ul>
          </div>
        ) : sales.length === 0 ? (
          <p className="text-silver-400 text-sm">{t("adminBeats.sinVentas")}</p>
        ) : (
          <div className="flex flex-col gap-8">
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
                  {t("adminBeats.pendientes")}
                </h2>
                {pendientes.length > 0 && (
                  <p className="text-amethyst-200 text-sm font-semibold">
                    {t("adminBeats.totalPendiente", {
                      monto: formatCOP(totalPendiente),
                    })}
                  </p>
                )}
              </div>

              {pendientes.length === 0 ? (
                <p className="text-silver-400 mt-3 text-sm">
                  {t("adminBeats.sinVentas")}
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {pendientes.map((sale) => (
                    <li
                      key={sale.id}
                      className={`flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-start sm:justify-between ${adminInner}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {sale.beatTitulo}
                        </p>
                        <p className="text-silver-400 mt-1 truncate text-xs">
                          {t("adminBeats.beatmaker")}:{" "}
                          {sale.beatmakerNombre ?? sale.beatmakerUid}
                          {" · "}
                          {t("adminBeats.comprador")}:{" "}
                          {sale.buyerNombre ?? sale.buyerUid}
                        </p>
                        <p className="text-silver-500 mt-1 text-xs">
                          {fechaCorta(sale.createdAt, locale)}
                        </p>
                        <div className="text-silver-300 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <span>
                            {t("adminBeats.precio")}: {formatCOP(sale.precio)}
                          </span>
                          <span>
                            {t("adminBeats.comision")}:{" "}
                            {formatCOP(sale.comision)}
                          </span>
                          <span className="font-semibold text-white">
                            {t("adminBeats.neto")}: {formatCOP(sale.neto)}
                          </span>
                        </div>
                      </div>
                      <GlassButton
                        onClick={() => marcarPagado(sale)}
                        disabled={!!payingId}
                        className="shrink-0 self-start !text-emerald-200"
                      >
                        {payingId === sale.id && (
                          <SpinnerIcon className="size-4 animate-spin" />
                        )}
                        {t("adminBeats.marcarPagado")}
                      </GlassButton>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {pagadas.length > 0 && (
              <section className="opacity-60">
                <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
                  {t("adminBeats.pagadas")}
                </h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {pagadas.map((sale) => (
                    <li
                      key={sale.id}
                      className={`flex flex-col gap-2 rounded-xl p-4 ${adminInner}`}
                    >
                      <p className="truncate text-sm font-semibold text-white">
                        {sale.beatTitulo}
                      </p>
                      <p className="text-silver-400 truncate text-xs">
                        {t("adminBeats.beatmaker")}:{" "}
                        {sale.beatmakerNombre ?? sale.beatmakerUid}
                        {" · "}
                        {t("adminBeats.comprador")}:{" "}
                        {sale.buyerNombre ?? sale.buyerUid}
                      </p>
                      <p className="text-silver-500 text-xs">
                        {fechaCorta(sale.createdAt, locale)}
                      </p>
                      <div className="text-silver-300 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span>
                          {t("adminBeats.precio")}: {formatCOP(sale.precio)}
                        </span>
                        <span>
                          {t("adminBeats.comision")}: {formatCOP(sale.comision)}
                        </span>
                        <span className="font-semibold text-white">
                          {t("adminBeats.neto")}: {formatCOP(sale.neto)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
