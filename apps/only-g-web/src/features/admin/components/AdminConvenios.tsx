"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { SpinnerIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import type { ConvenioRequest } from "@/domain/convenio";
import {
  listConvenioRequests,
  aprobarConvenio,
  rechazarConvenio,
} from "@/features/convenios/lib/convenio-repo";
import { getAllSedes } from "@/features/sedes/lib/sedes-repo";
import type { Sede } from "@/domain/sede";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import { AdminPageHeader, adminCard, adminInner, adminInput } from "./admin-ui";

// Disparador del select con la misma pinta de campo (adminInput) + layout flex
// para el texto y la flecha (SearchableSelect sustituye por completo su clase).
const selectCls = `flex w-full items-center justify-between gap-2 ${adminInput}`;

/**
 * Bandeja de SOLICITUDES DE CONVENIO (productor/beatmaker) para el admin.
 * Aprobar un `beatmaker` otorga el rol directo; aprobar un `productor` exige
 * elegir la sede a la que queda asignado. Ambas acciones (y el rechazo) son
 * server-authoritative — este componente solo llama al repo, que a su vez
 * llama las Cloud Functions correspondientes.
 */
export function AdminConvenios() {
  const t = useTranslations();
  const locale = useLocale();

  const [requests, setRequests] = useState<ConvenioRequest[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approveTarget, setApproveTarget] = useState<ConvenioRequest | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<ConvenioRequest | null>(
    null,
  );
  const [selectedSede, setSelectedSede] = useState("");
  const [motivo, setMotivo] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listConvenioRequests(), getAllSedes()])
      .then(([reqs, allSedes]) => {
        if (!active) return;
        setRequests(reqs);
        setSedes(allSedes);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[admin-convenios] load:", e);
        setError(t("adminConvenios.errorCargar"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const pendientes = requests.filter((r) => r.estado === "pendiente");
  const resueltas = requests.filter((r) => r.estado !== "pendiente");

  function marcarResuelta(id: string, estado: "aprobada" | "rechazada") {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, estado, resueltoAt: Date.now() } : r,
      ),
    );
  }

  function iniciarAprobacion(req: ConvenioRequest) {
    if (req.tipo === "productor") {
      setApproveTarget(req);
      setSelectedSede("");
      setModalError(null);
    } else {
      aprobar(req);
    }
  }

  async function aprobar(req: ConvenioRequest, sedeId?: string) {
    if (savingId) return;
    setSavingId(req.id);
    setModalError(null);
    setError(null);
    try {
      await aprobarConvenio(req.id, sedeId);
      marcarResuelta(req.id, "aprobada");
      setApproveTarget(null);
    } catch (e) {
      console.error("[admin-convenios] aprobar:", e);
      // El beatmaker se aprueba directo (sin modal) → banner de página; el
      // productor tiene modal abierto → error dentro del modal.
      if (req.tipo === "productor") {
        setModalError(t("adminConvenios.errorAprobar"));
      } else {
        setError(t("adminConvenios.errorAprobar"));
      }
    } finally {
      setSavingId(null);
    }
  }

  async function rechazar(req: ConvenioRequest) {
    if (savingId) return;
    setSavingId(req.id);
    setModalError(null);
    try {
      await rechazarConvenio(req.id, motivo.trim() || undefined);
      marcarResuelta(req.id, "rechazada");
      setRejectTarget(null);
    } catch (e) {
      console.error("[admin-convenios] rechazar:", e);
      setModalError(t("adminConvenios.errorRechazar"));
    } finally {
      setSavingId(null);
    }
  }

  const sedeOptions = sedes.map((s) => ({ value: s.id, label: s.nombre }));

  return (
    <main className="pb-24">
      <AdminPageHeader
        eyebrow={t("adminDashboard.eyebrow")}
        title={t("adminConvenios.title")}
        subtitle={t("adminConvenios.intro")}
      />

      <div className="px-6 sm:px-10">
        {error && (
          <p className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
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
        ) : (
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
                {t("adminConvenios.pendientes")}
              </h2>
              {pendientes.length === 0 ? (
                <p className="text-silver-400 mt-3 text-sm">
                  {t("adminConvenios.sinPendientes")}
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {pendientes.map((req) => (
                    <li
                      key={req.id}
                      className={`flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-start sm:justify-between ${adminInner}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">
                            {req.displayName ?? req.email ?? req.uid}
                          </p>
                          <span className="bg-amethyst-500/20 text-amethyst-200 rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase">
                            {t(`roles.${req.tipo}`)}
                          </span>
                        </div>
                        {req.email && (
                          <p className="text-silver-400 truncate text-xs">
                            {req.email}
                          </p>
                        )}
                        <p className="text-silver-500 mt-1 text-xs">
                          {fechaCorta(req.createdAt, locale)}
                        </p>
                        {req.mensaje && (
                          <p className="text-silver-300 mt-2 text-sm">
                            {req.mensaje}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-start">
                        <GlassButton
                          onClick={() => iniciarAprobacion(req)}
                          disabled={!!savingId}
                          className="!text-emerald-200"
                        >
                          {savingId === req.id && req.tipo === "beatmaker" && (
                            <SpinnerIcon className="size-4 animate-spin" />
                          )}
                          {t("adminConvenios.aprobar")}
                        </GlassButton>
                        <GlassButton
                          onClick={() => {
                            setRejectTarget(req);
                            setMotivo("");
                            setModalError(null);
                          }}
                          disabled={!!savingId}
                          className="!text-red-200"
                        >
                          {t("adminConvenios.rechazar")}
                        </GlassButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {resueltas.length > 0 && (
              <section className="opacity-60">
                <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
                  {t("adminConvenios.resueltas")}
                </h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {resueltas.map((req) => (
                    <li
                      key={req.id}
                      className={`flex flex-col gap-2 rounded-xl p-4 ${adminInner}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {req.displayName ?? req.email ?? req.uid}
                        </p>
                        <span className="bg-amethyst-500/20 text-amethyst-200 rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase">
                          {t(`roles.${req.tipo}`)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase ${
                            req.estado === "aprobada"
                              ? "bg-emerald-500/20 text-emerald-200"
                              : "bg-red-500/20 text-red-200"
                          }`}
                        >
                          {t(
                            `adminConvenios.estado.${req.estado === "aprobada" ? "aprobada" : "rechazada"}`,
                          )}
                        </span>
                      </div>
                      {req.email && (
                        <p className="text-silver-400 truncate text-xs">
                          {req.email}
                        </p>
                      )}
                      {req.motivo && (
                        <p className="text-silver-400 text-xs">{req.motivo}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Aprobar productor: elegir sede */}
      <GlassModal
        open={!!approveTarget}
        onClose={() => !savingId && setApproveTarget(null)}
        title={t("adminConvenios.elegirSede")}
      >
        {sedes.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-silver-300 text-sm">
              {t("adminConvenios.sinSedes")}
            </p>
            <Link
              href="/admin/estudios"
              className="text-amethyst-300 hover:text-amethyst-200 text-sm font-semibold underline-offset-4 hover:underline"
            >
              {t("adminConvenios.crearSede")}
            </Link>
          </div>
        ) : (
          <SearchableSelect
            value={selectedSede}
            onChange={setSelectedSede}
            options={sedeOptions}
            ariaLabel={t("adminConvenios.elegirSede")}
            className={selectCls}
          />
        )}

        {modalError && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {modalError}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <GlassButton
            onClick={() => setApproveTarget(null)}
            disabled={!!savingId}
          >
            {t("adminConvenios.cancelar")}
          </GlassButton>
          <GlassButton
            onClick={() =>
              approveTarget && aprobar(approveTarget, selectedSede)
            }
            disabled={!!savingId || !selectedSede || sedes.length === 0}
            className="!text-emerald-200"
          >
            {savingId === approveTarget?.id && (
              <SpinnerIcon className="size-4 animate-spin" />
            )}
            {t("adminConvenios.confirmar")}
          </GlassButton>
        </div>
      </GlassModal>

      {/* Rechazar (productor o beatmaker) */}
      <GlassModal
        open={!!rejectTarget}
        onClose={() => !savingId && setRejectTarget(null)}
        title={t("adminConvenios.rechazar")}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-silver-400 text-xs tracking-wide uppercase">
            {t("adminConvenios.motivo")}
          </span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t("adminConvenios.motivoPlaceholder")}
            rows={3}
            className={adminInput}
          />
        </label>

        {modalError && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {modalError}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <GlassButton
            onClick={() => setRejectTarget(null)}
            disabled={!!savingId}
          >
            {t("adminConvenios.cancelar")}
          </GlassButton>
          <GlassButton
            onClick={() => rejectTarget && rechazar(rejectTarget)}
            disabled={!!savingId}
            className="!text-red-200"
          >
            {savingId === rejectTarget?.id && (
              <SpinnerIcon className="size-4 animate-spin" />
            )}
            {t("adminConvenios.confirmar")}
          </GlassButton>
        </div>
      </GlassModal>
    </main>
  );
}
