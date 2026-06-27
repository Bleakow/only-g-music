"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { PlusIcon, TrashIcon, SpinnerIcon } from "@/components/icons";
import { formatCOP } from "@/domain/service";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import {
  type Activo,
  activoVigente,
  totalesInventario,
  valorEnLibros,
  valorPorCategoria,
} from "@/domain/contabilidad";
import { listActivos, darDeBajaActivo } from "../lib/activos-repo";
import { AddActivoModal } from "./AddActivoModal";

export function AdminBienes({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useTranslations();
  const locale = useLocale();
  // "ahora" estable por carga: la depreciación no cambia entre renders.
  const [now] = useState(() => Date.now());

  const [activos, setActivos] = useState<Activo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Baja lógica
  const [bajaTarget, setBajaTarget] = useState<Activo | null>(null);
  const [bajaMotivo, setBajaMotivo] = useState("");
  const [bajaBusy, setBajaBusy] = useState(false);

  function recargar() {
    setLoading(true);
    listActivos()
      .then((data) => {
        setActivos(data);
        setError(null);
      })
      .catch((e) => {
        console.error("[bienes] load:", e);
        setError(t("adminBienes.loadError"));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    listActivos()
      .then((data) => active && setActivos(data))
      .catch((e) => {
        if (!active) return;
        console.error("[bienes] load:", e);
        setError(t("adminBienes.loadError"));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [t]);

  const totales = totalesInventario(activos, now);
  const porCategoria = valorPorCategoria(activos, now);
  const maxCat = Math.max(1, ...porCategoria.map((c) => c.valorEnLibros));
  // Vigentes primero (por valor en libros desc), luego los dados de baja.
  const ordenados = [...activos].sort((a, b) => {
    const va = activoVigente(a, now);
    const vb = activoVigente(b, now);
    if (va !== vb) return va ? -1 : 1;
    return valorEnLibros(b, now) - valorEnLibros(a, now);
  });

  async function confirmarBaja() {
    if (!bajaTarget || bajaBusy) return;
    setBajaBusy(true);
    try {
      await darDeBajaActivo(bajaTarget.id, bajaMotivo.trim());
      setBajaTarget(null);
      setBajaMotivo("");
      recargar();
    } catch (e) {
      console.error("[bienes] baja:", e);
    } finally {
      setBajaBusy(false);
    }
  }

  return (
    <div
      className={
        embedded ? "" : "mx-auto min-h-dvh max-w-4xl px-6 pt-28 pb-24 sm:px-12"
      }
    >
      {!embedded && (
        <Link
          href="/admin"
          className="text-silver-300 text-sm underline-offset-4 hover:text-white hover:underline"
        >
          {t("adminBienes.backToAdmin")}
        </Link>
      )}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-narrow text-5xl font-bold uppercase sm:text-6xl">
            {t("adminBienes.title")}
          </h1>
          <p className="text-silver-300 mt-2 max-w-xl">
            {t("adminBienes.intro")}
          </p>
        </div>
        <GlassButton
          onClick={() => setShowAdd(true)}
          className="!text-amethyst-200"
        >
          <PlusIcon className="size-4" />
          {t("adminBienes.addButton")}
        </GlassButton>
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
          {/* Resumen */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-amethyst-300/30 bg-amethyst-500/10 rounded-2xl border p-5 sm:col-span-2 lg:col-span-1">
              <p className="text-amethyst-200 text-xs tracking-[2px] uppercase">
                {t("adminBienes.bookValueTotal")}
              </p>
              <p className="font-narrow mt-1 text-3xl font-bold text-white">
                {formatCOP(totales.valorEnLibrosTotal)}
              </p>
            </div>
            <SummaryCard
              label={t("adminBienes.acquisitionTotal")}
              value={formatCOP(totales.valorAdquisicionTotal)}
            />
            <SummaryCard
              label={t("adminBienes.depreciationTotal")}
              value={formatCOP(totales.depreciacionTotal)}
            />
            <SummaryCard
              label={t("adminBienes.count")}
              value={String(totales.cantidad)}
            />
          </div>

          {/* Desglose por categoría */}
          {porCategoria.length > 0 && (
            <section className="mt-10">
              <h2 className="font-narrow text-2xl font-bold text-white uppercase">
                {t("adminBienes.byCategory")}
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                {porCategoria.map((c) => (
                  <div key={c.categoria} className="flex items-center gap-3">
                    <span className="text-silver-300 w-40 shrink-0 truncate text-sm">
                      {t(`adminBienes.categoria.${c.categoria}`)}
                    </span>
                    <div className="h-6 flex-1 overflow-hidden rounded bg-white/5">
                      <div
                        className="from-silver-100 to-amethyst-300 h-full rounded bg-gradient-to-r"
                        style={{
                          width: `${(c.valorEnLibros / maxCat) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-32 shrink-0 text-right text-sm font-semibold text-white tabular-nums">
                      {formatCOP(c.valorEnLibros)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Inventario */}
          <section className="mt-10">
            <h2 className="font-narrow text-2xl font-bold text-white uppercase">
              {t("adminBienes.inventory")}
            </h2>
            {ordenados.length === 0 ? (
              <p className="text-silver-400 mt-2">{t("adminBienes.empty")}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="text-silver-400 bg-white/[0.03] text-xs tracking-wide uppercase">
                    <tr>
                      <th className="px-4 py-3">{t("adminBienes.colName")}</th>
                      <th className="px-4 py-3">
                        {t("adminBienes.colCategory")}
                      </th>
                      <th className="px-4 py-3">{t("adminBienes.colSede")}</th>
                      <th className="px-4 py-3">{t("adminBienes.colDate")}</th>
                      <th className="px-4 py-3 text-right">
                        {t("adminBienes.colAcquisition")}
                      </th>
                      <th className="px-4 py-3 text-right">
                        {t("adminBienes.colBookValue")}
                      </th>
                      <th className="px-4 py-3 text-right">
                        {t("adminBienes.colActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ordenados.map((a) => {
                      const vigente = activoVigente(a, now);
                      return (
                        <tr key={a.id} className={vigente ? "" : "opacity-45"}>
                          <td className="px-4 py-3">
                            <span className="text-silver-100 flex items-center gap-2">
                              {a.fotoUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={a.fotoUrl}
                                  alt=""
                                  className="size-8 shrink-0 rounded object-cover"
                                />
                              )}
                              <span className="truncate">{a.nombre}</span>
                              {!vigente && (
                                <span className="text-silver-400 shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] tracking-wide uppercase">
                                  {t("adminBienes.statusRetired")}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="text-silver-300 px-4 py-3">
                            {t(`adminBienes.categoria.${a.categoria}`)}
                          </td>
                          <td className="text-silver-400 px-4 py-3">
                            {a.sede
                              ? t(`adminBienes.sedes.${a.sede}`)
                              : t("adminBienes.noSede")}
                          </td>
                          <td className="text-silver-400 px-4 py-3">
                            {fechaCorta(a.fechaAdquisicion, locale)}
                          </td>
                          <td className="text-silver-300 px-4 py-3 text-right tabular-nums">
                            {formatCOP(a.valorAdquisicion)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">
                            {formatCOP(valorEnLibros(a, now))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {vigente && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBajaTarget(a);
                                  setBajaMotivo("");
                                }}
                                aria-label={t("adminBienes.retire")}
                                className="text-silver-400 inline-flex size-8 items-center justify-center rounded-full transition hover:bg-red-500/10 hover:text-red-300"
                              >
                                <TrashIcon className="size-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <AddActivoModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false);
          recargar();
        }}
      />

      {/* Confirmación de baja */}
      <GlassModal
        open={bajaTarget !== null}
        onClose={() => !bajaBusy && setBajaTarget(null)}
        title={t("adminBienes.retireModal.title")}
        className="max-w-md"
      >
        <p className="text-silver-300 text-sm">
          {t("adminBienes.retireModal.message", {
            name: bajaTarget?.nombre ?? "",
          })}
        </p>
        <input
          value={bajaMotivo}
          onChange={(e) => setBajaMotivo(e.target.value)}
          placeholder={t("adminBienes.retireModal.reasonPlaceholder")}
          className="mt-4 w-full rounded-lg bg-white/[0.06] px-3 py-2 text-white ring-1 ring-white/20 transition outline-none ring-inset placeholder:text-white/40 focus:ring-white/50"
        />
        <div className="mt-5 flex items-center justify-end gap-3">
          <GlassButton onClick={() => setBajaTarget(null)} disabled={bajaBusy}>
            {t("adminBienes.retireModal.cancel")}
          </GlassButton>
          <GlassButton
            onClick={confirmarBaja}
            disabled={bajaBusy}
            className="!text-red-300"
          >
            {bajaBusy ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : (
              <TrashIcon className="size-4" />
            )}
            {t("adminBienes.retireModal.confirm")}
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-silver-400 text-xs tracking-[2px] uppercase">
        {label}
      </p>
      <p className="font-narrow mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
