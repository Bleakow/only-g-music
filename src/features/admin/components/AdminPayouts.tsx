"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpinnerIcon, CopyIcon, CheckIcon, PlusIcon } from "@/components/icons";
import { formatCOP } from "@/domain/service";
import {
  type Payout,
  agruparPayoutsPendientes,
} from "@/domain/payout";
import type { DatosPagoSocio } from "@/domain/datos-pago";
import { getDatosPago } from "@/features/socios/lib/datos-pago-repo";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import {
  listPayouts,
  backfillPayouts,
  registrarPagoPayout,
  registrarPagosPayout,
  type MetodoLiquidacion,
} from "@/features/admin/lib/payouts-repo";
import { PayoutPagoModal } from "./PayoutPagoModal";
import { PayoutProduccionModal } from "./PayoutProduccionModal";
import { AdminPageHeader, adminCard, adminInner } from "./admin-ui";

/**
 * Panel de CUENTAS POR PAGAR (Fase 3): liquida por PERSONA lo que Only G le debe a
 * cada socio. Generaliza el panel viejo de payouts de beats: agrupa los payouts
 * pendientes por acreedor, muestra SUS datos de pago inline (banco/Nequi/efectivo,
 * con el número a la vista para copiar) y liquida cada payout —o todos de golpe—
 * con método + comprobante vía la Cloud Function `registrarPagoPayout(s)`.
 *
 * Server-authoritative: `payouts` no se escribe desde el cliente; la liquidación
 * pasa por Cloud Function (assertAdmin, idempotente) que además sincroniza
 * `beatSales.paidOut` en los payouts de beat. Update optimista aquí para que la
 * fila salte a "liquidados" al instante. Datos de pago SENSIBLES: no se loguean.
 */

/** Target del modal: liquidar UN payout o TODOS los de una persona. */
type Target =
  | { kind: "one"; id: string; nombre: string; monto: number; metodo: MetodoLiquidacion }
  | {
      kind: "all";
      ids: string[];
      nombre: string;
      monto: number;
      metodo: MetodoLiquidacion;
    };

export function AdminPayouts() {
  const t = useTranslations();
  const locale = useLocale();

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [datos, setDatos] = useState<Record<string, DatosPagoSocio | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [showPagados, setShowPagados] = useState(false);
  const [showRegistrar, setShowRegistrar] = useState(false);

  const cargar = useCallback(async () => {
    const list = await listPayouts();
    setPayouts(list);
    // Datos de pago SOLO de los acreedores con deuda pendiente (el admin puede
    // leerlos). Best-effort por persona: si uno falla, se muestra "sin datos".
    const uids = Array.from(
      new Set(
        list.filter((p) => p.estado === "pendiente").map((p) => p.acreedorUid),
      ),
    );
    const entries = await Promise.all(
      uids.map(
        async (uid) =>
          [uid, await getDatosPago(uid).catch(() => null)] as const,
      ),
    );
    setDatos(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    let active = true;
    cargar()
      .catch((e) => {
        if (!active) return;
        console.error("[admin-payouts] load:", e);
        setError(t("adminPayouts.errorCargar"));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [cargar, t]);

  const grupos = useMemo(() => agruparPayoutsPendientes(payouts), [payouts]);
  const pagados = useMemo(
    () => payouts.filter((p) => p.estado === "pagado"),
    [payouts],
  );
  const totalPendiente = useMemo(
    () => grupos.reduce((s, g) => s + g.total, 0),
    [grupos],
  );

  /** Update optimista: marca los ids como pagados (saltan a "liquidados"). */
  function marcarPagados(
    ids: string[],
    metodo: MetodoLiquidacion,
    comprobanteUrl?: string,
  ) {
    const set = new Set(ids);
    const now = Date.now();
    setPayouts((prev) =>
      prev.map((p) =>
        set.has(p.id)
          ? { ...p, estado: "pagado", pagadoAt: now, metodo, comprobanteUrl }
          : p,
      ),
    );
  }

  /** Confirmación del modal: llama a la Cloud Function y actualiza optimista.
   *  Propaga el error (el modal lo muestra y NO cierra si algo falla). */
  async function confirmar(metodo: MetodoLiquidacion, comprobanteUrl?: string) {
    if (!target) return;
    if (target.kind === "one") {
      await registrarPagoPayout(target.id, metodo, comprobanteUrl);
      marcarPagados([target.id], metodo, comprobanteUrl);
    } else {
      await registrarPagosPayout(target.ids, metodo, comprobanteUrl);
      marcarPagados(target.ids, metodo, comprobanteUrl);
    }
  }

  /** Método sugerido para una persona (el de sus datos de pago, o banco). */
  function metodoSugerido(uid: string): MetodoLiquidacion {
    return datos[uid]?.metodo ?? "banco";
  }

  async function sincronizar() {
    if (backfilling) return;
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const count = await backfillPayouts();
      await cargar();
      setBackfillMsg(t("adminPayouts.backfillDone", { count }));
    } catch (e) {
      console.error("[admin-payouts] backfill:", e);
      setBackfillMsg(t("adminPayouts.backfillError"));
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <main className="pb-24">
      <AdminPageHeader
        eyebrow={t("adminDashboard.eyebrow")}
        title={t("adminPayouts.title")}
        subtitle={t("adminPayouts.intro")}
      >
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <GlassButton
            onClick={() => setShowRegistrar(true)}
            className="!text-amethyst-200"
          >
            <PlusIcon className="size-4" />
            {t("adminPayouts.produccion.registrar")}
          </GlassButton>
          <GlassButton onClick={sincronizar} disabled={backfilling}>
            {backfilling && <SpinnerIcon className="size-4 animate-spin" />}
            {t("adminPayouts.backfill")}
          </GlassButton>
          {backfillMsg && (
            <span className="text-silver-300 text-sm">{backfillMsg}</span>
          )}
        </div>
      </AdminPageHeader>

      <div className="px-6 sm:px-10">
        {error && (
          <p className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className={`${adminCard} p-5`}>
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="mt-3 h-4 w-1/2" />
                <Skeleton className="mt-4 h-16 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : grupos.length === 0 && pagados.length === 0 ? (
          <p className="text-silver-400 text-sm">
            {t("adminPayouts.sinPayouts")}
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Por pagar (agrupado por persona) */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
                  {t("adminPayouts.pendientes")}
                </h2>
                {grupos.length > 0 && (
                  <p className="text-amethyst-200 text-sm font-semibold">
                    {t("adminPayouts.totalPendiente", {
                      monto: formatCOP(totalPendiente),
                    })}
                  </p>
                )}
              </div>

              {grupos.length === 0 ? (
                <p className="text-silver-400 mt-3 text-sm">
                  {t("adminPayouts.sinPendientes")}
                </p>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  {grupos.map((g) => {
                    const nombre = g.acreedorNombre ?? g.acreedorUid;
                    return (
                      <div key={g.acreedorUid} className={`${adminCard} p-5`}>
                        {/* Cabecera de persona: nombre + deuda + pagar todo */}
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-white">
                              {nombre}
                            </p>
                            <p className="text-amethyst-200 mt-0.5 text-sm font-semibold">
                              {t("adminPayouts.deudaPersona", {
                                monto: formatCOP(g.total),
                              })}
                            </p>
                          </div>
                          <GlassButton
                            onClick={() =>
                              setTarget({
                                kind: "all",
                                ids: g.payouts.map((p) => p.id),
                                nombre,
                                monto: g.total,
                                metodo: metodoSugerido(g.acreedorUid),
                              })
                            }
                            className="shrink-0 !text-emerald-200"
                          >
                            {t("adminPayouts.pagarTodo")}
                          </GlassButton>
                        </div>

                        {/* Datos de pago del socio (inline, con copiar) */}
                        <div className={`mt-4 rounded-xl p-4 ${adminInner}`}>
                          <p className="text-silver-400 mb-2 text-xs tracking-wide uppercase">
                            {t("adminPayouts.datosTitulo")}
                          </p>
                          <DatosPagoInline datos={datos[g.acreedorUid]} />
                        </div>

                        {/* Payouts pendientes de esta persona */}
                        <ul className="mt-4 flex flex-col gap-2.5">
                          {g.payouts.map((p) => (
                            <li
                              key={p.id}
                              className={`flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between ${adminInner}`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-amethyst-100 rounded-full bg-white/[0.06] px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase ring-1 ring-white/15 ring-inset">
                                    {t(`adminPayouts.origen.${p.origen}`)}
                                  </span>
                                  <span className="text-silver-500 text-xs">
                                    {fechaCorta(p.createdAt, locale)}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-semibold text-white">
                                  {formatCOP(p.monto)}
                                </p>
                                {p.nota && (
                                  <p className="text-silver-400 mt-0.5 truncate text-xs">
                                    {p.nota}
                                  </p>
                                )}
                              </div>
                              <GlassButton
                                onClick={() =>
                                  setTarget({
                                    kind: "one",
                                    id: p.id,
                                    nombre,
                                    monto: p.monto,
                                    metodo: metodoSugerido(g.acreedorUid),
                                  })
                                }
                                className="shrink-0 self-start !text-emerald-200 sm:self-center"
                              >
                                {t("adminPayouts.marcarPagado")}
                              </GlassButton>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Liquidados (historial, colapsable) */}
            {pagados.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowPagados((v) => !v)}
                  className="text-silver-300 flex items-center gap-2 text-sm font-semibold tracking-wide uppercase transition hover:text-white"
                >
                  {showPagados
                    ? t("adminPayouts.ocultarPagados")
                    : t("adminPayouts.verPagados", { count: pagados.length })}
                </button>

                {showPagados && (
                  <ul className="mt-4 flex flex-col gap-2.5 opacity-70">
                    {pagados.map((p) => (
                      <li
                        key={p.id}
                        className={`flex flex-col gap-1 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between ${adminInner}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {p.acreedorNombre ?? p.acreedorUid}
                          </p>
                          <p className="text-silver-500 mt-0.5 text-xs">
                            {t(`adminPayouts.origen.${p.origen}`)}
                            {p.metodo
                              ? ` · ${t(`datosPago.metodo.${p.metodo}`)}`
                              : ""}
                            {p.pagadoAt
                              ? ` · ${fechaCorta(p.pagadoAt, locale)}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {p.comprobanteUrl && (
                            <a
                              href={p.comprobanteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amethyst-200 text-xs underline-offset-2 hover:text-white hover:underline"
                            >
                              {t("adminPayouts.verComprobante")}
                            </a>
                          )}
                          <span className="text-sm font-semibold text-white">
                            {formatCOP(p.monto)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      <PayoutPagoModal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target?.nombre ?? ""}
        monto={target?.monto ?? 0}
        defaultMetodo={target?.metodo ?? "banco"}
        onConfirm={confirmar}
      />

      <PayoutProduccionModal
        open={showRegistrar}
        onClose={() => setShowRegistrar(false)}
        onCreated={async () => {
          setShowRegistrar(false);
          await cargar();
        }}
      />
    </main>
  );
}

/** Fila etiqueta/valor pequeña (datos secundarios del método). */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-silver-500 text-[0.7rem] tracking-wide uppercase">
        {label}
      </p>
      <p className="truncate text-sm text-white">{value}</p>
    </div>
  );
}

/** Valor destacado con botón de copiar (número de cuenta / Nequi). */
function CopyValue({ label, value }: { label: string; value: string }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sin clipboard: el admin copia a mano */
    }
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-silver-500 text-[0.7rem] tracking-wide uppercase">
          {label}
        </p>
        <p className="truncate font-mono text-sm text-white">{value || "—"}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        disabled={!value}
        className="text-silver-200 inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs transition hover:border-amethyst-300/60 hover:text-white disabled:opacity-50"
      >
        {copied ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
        {copied ? t("adminPayouts.copied") : t("adminPayouts.copy")}
      </button>
    </div>
  );
}

/** Datos de pago de un socio, en modo lectura (banco / Nequi / efectivo). */
function DatosPagoInline({
  datos,
}: {
  datos: DatosPagoSocio | null | undefined;
}) {
  const t = useTranslations();

  if (!datos) {
    return (
      <p className="text-xs text-amber-200/80">{t("adminPayouts.sinDatos")}</p>
    );
  }

  const badge = (
    <span className="text-amethyst-100 inline-block rounded-full bg-amethyst-500/15 px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ring-1 ring-amethyst-400/30 ring-inset">
      {t(`datosPago.metodo.${datos.metodo}`)}
    </span>
  );

  if (datos.metodo === "banco" && datos.banco) {
    const b = datos.banco;
    return (
      <div className="flex flex-col gap-3">
        {badge}
        <CopyValue label={t("datosPago.banco.numeroCuenta")} value={b.numeroCuenta} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("datosPago.banco.entidad")} value={b.entidad} />
          <Field
            label={t("datosPago.banco.tipoCuenta")}
            value={t(`datosPago.tipoCuenta.${b.tipoCuenta}`)}
          />
          <Field label={t("datosPago.banco.titular")} value={b.titular} />
          <Field
            label={t("datosPago.banco.numeroDoc")}
            value={`${b.tipoDoc} ${b.numeroDoc}`}
          />
        </div>
      </div>
    );
  }

  if (datos.metodo === "nequi" && datos.nequi) {
    const n = datos.nequi;
    return (
      <div className="flex flex-col gap-3">
        {badge}
        <CopyValue label={t("datosPago.nequi.telefono")} value={n.telefono} />
        <Field label={t("datosPago.nequi.titular")} value={n.titular} />
      </div>
    );
  }

  // Efectivo (o método sin sub-objeto): badge + nota/hint.
  return (
    <div className="flex flex-col gap-2">
      {badge}
      <p className="text-silver-300 text-sm">
        {datos.efectivo?.nota?.trim() || t("datosPago.efectivo.hint")}
      </p>
    </div>
  );
}
