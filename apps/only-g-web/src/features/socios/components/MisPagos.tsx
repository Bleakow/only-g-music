"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatCOP } from "@only-g/shared-types/service";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import { type Payout, totalPayoutsPendientes } from "@only-g/shared-types/payout";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { listMisPayouts } from "@/features/admin/lib/payouts-repo";
import { Skeleton } from "@/components/ui/Skeleton";

const BADGE =
  "text-amethyst-100 rounded-full bg-white/[0.06] px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase ring-1 ring-white/15 ring-inset";

/**
 * "Mis pagos" del SOCIO (beatmaker/productor): lo que Only G le debe por sus
 * ventas/trabajos — pendiente + histórico pagado (con método y fecha). SOLO
 * lectura: las reglas dejan al acreedor leer SUS propios `payouts`
 * (`acreedorUid == auth.uid`); no ve los de nadie más ni escribe. La
 * transferencia la hace el admin manual; aquí el socio solo consulta.
 */
export function MisPagos() {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    listMisPayouts(user.uid)
      .then((p) => active && setPayouts(p))
      .catch((e) => {
        console.error("[mis-pagos]:", e);
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const lista = payouts ?? [];
  const pendientes = lista.filter((p) => p.estado === "pendiente");
  const pagados = lista.filter((p) => p.estado === "pagado");
  const totalPend = totalPayoutsPendientes(lista);

  function fila(p: Payout, pagado: boolean) {
    return (
      <li
        key={p.id}
        className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={BADGE}>{t(`adminPayouts.origen.${p.origen}`)}</span>
              <span className="text-silver-500 text-xs">
                {fechaCorta(p.createdAt, locale)}
              </span>
            </div>
            {p.nota && (
              <p className="text-silver-400 mt-1 text-xs">{p.nota}</p>
            )}
            {pagado && p.pagadoAt && (
              <p className="mt-1 text-xs text-emerald-300">
                {t("misPagos.pagadoEl", {
                  fecha: fechaCorta(p.pagadoAt, locale),
                  metodo: p.metodo ? t(`datosPago.metodo.${p.metodo}`) : "—",
                })}
              </p>
            )}
          </div>
          <span className="shrink-0 text-sm font-semibold text-white">
            {formatCOP(p.monto)}
          </span>
        </div>
      </li>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pt-28 pb-24 sm:px-8">
      <p className="text-amethyst-300 text-sm tracking-[4px] uppercase">
        {t("misPagos.eyebrow")}
      </p>
      <h1 className="font-narrow mt-2 text-5xl font-bold uppercase sm:text-6xl">
        {t("misPagos.title")}
      </h1>
      <p className="text-silver-300 mt-3">{t("misPagos.intro")}</p>

      {/* Total pendiente */}
      <div className="border-amethyst-300/30 bg-amethyst-500/10 mt-8 rounded-2xl border p-5">
        <p className="text-amethyst-200 text-xs tracking-[2px] uppercase">
          {t("misPagos.totalPendiente")}
        </p>
        <p className="font-narrow mt-1 text-4xl font-bold text-white">
          {formatCOP(totalPend)}
        </p>
        <p className="text-silver-400 mt-1 text-sm">{t("misPagos.totalHint")}</p>
      </div>

      {payouts === null ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-silver-400 mt-8 text-sm">{t("misPagos.error")}</p>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="font-narrow text-2xl font-bold text-white uppercase">
              {t("misPagos.pendientes")}
            </h2>
            {pendientes.length === 0 ? (
              <p className="text-silver-400 mt-3 text-sm">
                {t("misPagos.sinPendientes")}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2.5">
                {pendientes.map((p) => fila(p, false))}
              </ul>
            )}
          </section>

          {pagados.length > 0 && (
            <section className="mt-10">
              <h2 className="font-narrow text-2xl font-bold text-white uppercase">
                {t("misPagos.historial")}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {pagados.map((p) => fila(p, true))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
