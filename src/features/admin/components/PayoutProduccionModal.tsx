"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SpinnerIcon, CheckIcon } from "@/components/icons";
import type { Sede } from "@/domain/sede";
import { getAllSedes } from "@/features/sedes/lib/sedes-repo";
import {
  listProductores,
  type ProductorLite,
} from "@/features/admin/lib/admin-users-repo";
import { registrarPayoutProduccion } from "@/features/admin/lib/payouts-repo";
import { adminInput, adminLabel } from "./admin-ui";

const inputCls = adminInput;
const labelCls = adminLabel;
const selectCls = `flex w-full items-center justify-between gap-2 ${inputCls}`;

/**
 * Alta MANUAL de una cuenta por pagar a un PRODUCTOR (Fase 4). El admin declara el
 * NETO directo que Only G le debe por su trabajo (sin comisión automática). El
 * destinatario se elige de la lista de productores (derivada de las sedes); el
 * monto es un entero de COP > 0; sede y nota son opcionales (la sede se prefija con
 * la del productor si la tiene). Server-authoritative: crea el payout vía la Cloud
 * Function `registrarPayoutProduccion`, que revalida el rol `productor`. Guard
 * anti-doble-submit (`busy`): el alta NO es idempotente por diseño.
 */
export function PayoutProduccionModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations();

  const [productores, setProductores] = useState<ProductorLite[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(false);

  const [acreedorUid, setAcreedorUid] = useState("");
  const [monto, setMonto] = useState("");
  const [sede, setSede] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga la lista de productores + sedes CADA vez que se abre (un productor pudo
  // asignarse a una sede entre aperturas). Best-effort: si falla, el selector
  // queda vacío y el admin no puede registrar (mejor que una lista obsoleta).
  useEffect(() => {
    if (!open) return;
    setBusy(false); // robustez: nunca reabrir en estado busy pegado.
    let active = true;
    setCargando(true);
    Promise.all([listProductores(), getAllSedes()])
      .then(([prods, seds]) => {
        if (!active) return;
        setProductores(prods);
        setSedes(seds);
      })
      .catch(() => {})
      .finally(() => active && setCargando(false));
    return () => {
      active = false;
    };
  }, [open]);

  function reset() {
    setAcreedorUid("");
    setMonto("");
    setSede("");
    setNota("");
    setError(null);
  }

  /** Al elegir productor: prefija la sede con la suya (si la tiene). */
  function elegirProductor(uid: string) {
    setAcreedorUid(uid);
    const p = productores.find((x) => x.uid === uid);
    setSede(p?.sedeId ?? "");
  }

  const montoNum = Number(monto);
  const valido = acreedorUid !== "" && Number.isInteger(montoNum) && montoNum > 0;

  async function guardar() {
    if (!valido || busy) return;
    setBusy(true);
    setError(null);
    try {
      await registrarPayoutProduccion({
        acreedorUid,
        monto: montoNum,
        sede: sede || undefined,
        nota: nota.trim() || undefined,
      });
      reset();
      onCreated();
    } catch (e) {
      console.error("[payouts] registrarPayoutProduccion:", e);
      // Feedback preciso si el servidor rechaza por rol (defensa en profundidad):
      // el destinatario dejó de ser productor entre cargar la lista y confirmar.
      const code = (e as { code?: string })?.code;
      setError(
        code === "functions/failed-precondition"
          ? t("adminPayouts.produccion.errorNoProductor")
          : t("adminPayouts.produccion.error"),
      );
    } finally {
      // SIEMPRE liberar busy (el modal se re-renderiza, nunca se desmonta): sin
      // esto, tras un registro exitoso busy quedaría en true y bloquearía el
      // modal (ni registrar otro ni cerrar) hasta recargar la página.
      setBusy(false);
    }
  }

  function cerrar() {
    if (busy) return;
    reset();
    onClose();
  }

  return (
    <GlassModal
      open={open}
      onClose={cerrar}
      title={t("adminPayouts.produccion.title")}
      className="max-w-lg"
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <p className="text-silver-400 text-sm">
          {t("adminPayouts.produccion.intro")}
        </p>

        <div>
          <label className={labelCls}>
            {t("adminPayouts.produccion.productor")}
          </label>
          <SearchableSelect
            value={acreedorUid}
            onChange={elegirProductor}
            options={productores.map((p) => ({
              value: p.uid,
              label: p.sedeNombre ? `${p.nombre} · ${p.sedeNombre}` : p.nombre,
            }))}
            placeholder={t("adminPayouts.produccion.productorPlaceholder")}
            searchPlaceholder={t("adminPayouts.produccion.productorBuscar")}
            emptyText={t("adminPayouts.produccion.sinProductores")}
            loading={cargando}
            ariaLabel={t("adminPayouts.produccion.productor")}
            className={selectCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            {t("adminPayouts.produccion.monto")}
          </label>
          <MoneyInput
            value={monto}
            onChange={setMonto}
            placeholder="0"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            {t("adminPayouts.produccion.sede")}
          </label>
          <SearchableSelect
            value={sede}
            onChange={setSede}
            options={[
              { value: "", label: t("adminPayouts.produccion.sedeNone") },
              ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
            ]}
            ariaLabel={t("adminPayouts.produccion.sede")}
            className={selectCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            {t("adminPayouts.produccion.nota")}
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder={t("adminPayouts.produccion.notaPlaceholder")}
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <GlassButton onClick={cerrar} disabled={busy}>
          {t("adminPayouts.produccion.cancelar")}
        </GlassButton>
        <GlassButton
          onClick={guardar}
          disabled={!valido || busy}
          className="!text-amethyst-200"
        >
          {busy ? (
            <SpinnerIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          {busy
            ? t("adminPayouts.produccion.registrando")
            : t("adminPayouts.produccion.confirmar")}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
