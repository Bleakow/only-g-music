"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { DatePicker } from "@/components/ui/DatePicker";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SpinnerIcon, CheckIcon, ImageIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { uploadUserFile } from "@/features/uploads/lib/uploads-repo";
import {
  type NuevoMovimiento,
  type GastoCategoria,
  type Recurrencia,
  GASTO_CATEGORIAS,
  RECURRENCIAS,
} from "@/domain/contabilidad";
import type { Sede, SedeId } from "@/domain/sede";
import { getAllSedes } from "@/features/sedes/lib/sedes-repo";
import { addMovimiento } from "../lib/movimientos-repo";
import { adminInput, adminLabel } from "./admin-ui";

const inputCls = adminInput;
const labelCls = adminLabel;
// Disparador del select con la misma pinta de campo (adminInput) + layout flex
// para el texto y la flecha (SearchableSelect sustituye por completo su clase).
const selectCls = `flex w-full items-center justify-between gap-2 ${inputCls}`;

/** epoch ms → "YYYY-MM-DD" para <input type="date">. */
function toDateInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Registro de un gasto. Sube el comprobante (opcional) a Storage y persiste el
 * movimiento vía `movimientos-repo` (server pone createdBy/createdAt).
 */
export function AddMovimientoModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations();
  const { user } = useAuth();
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState<GastoCategoria>("nomina");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => toDateInput(Date.now()));
  const [recurrencia, setRecurrencia] = useState<Recurrencia>("unico");
  const [hasta, setHasta] = useState("");
  const [sede, setSede] = useState<SedeId | "">("");
  const [nota, setNota] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [sedes, setSedes] = useState<Sede[]>([]);

  useEffect(() => {
    let active = true;
    getAllSedes()
      .then((list) => active && setSedes(list))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const montoNum = Number(monto);
  const valido =
    concepto.trim() !== "" && montoNum > 0 && fecha !== "" && !!user;

  function reset() {
    setConcepto("");
    setCategoria("nomina");
    setMonto("");
    setFecha(toDateInput(Date.now()));
    setRecurrencia("unico");
    setHasta("");
    setSede("");
    setNota("");
    setComprobante(null);
  }

  async function guardar() {
    if (!valido || !user || busy) return;
    setBusy(true);
    setError(false);
    try {
      const comprobanteUrl = comprobante
        ? (await uploadUserFile(user.uid, comprobante)).url
        : undefined;
      const nuevo: NuevoMovimiento = {
        concepto: concepto.trim(),
        categoria,
        monto: montoNum,
        fecha: new Date(fecha).getTime(),
        recurrencia,
        recurrenciaHasta:
          recurrencia !== "unico" && hasta
            ? new Date(hasta).getTime()
            : undefined,
        sede: sede || undefined,
        comprobanteUrl,
        nota: nota.trim() || undefined,
      };
      await addMovimiento(nuevo, user.uid);
      reset();
      onCreated();
    } catch (e) {
      console.error("[gastos] addMovimiento:", e);
      setError(true);
      setBusy(false);
    }
  }

  return (
    <GlassModal
      open={open}
      onClose={() => !busy && onClose()}
      title={t("adminGastos.add.title")}
      className="max-w-lg"
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <div>
          <label className={labelCls}>{t("adminGastos.add.concept")}</label>
          <input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder={t("adminGastos.add.conceptPlaceholder")}
            autoFocus
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t("adminGastos.add.category")}</label>
            <SearchableSelect
              value={categoria}
              onChange={(v) => setCategoria(v as GastoCategoria)}
              options={GASTO_CATEGORIAS.map((c) => ({
                value: c,
                label: t(`adminGastos.categoria.${c}`),
              }))}
              ariaLabel={t("adminGastos.add.category")}
              className={selectCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              {t("adminGastos.add.recurrence")}
            </label>
            <SearchableSelect
              value={recurrencia}
              onChange={(v) => setRecurrencia(v as Recurrencia)}
              options={RECURRENCIAS.map((r) => ({
                value: r,
                label: t(`adminGastos.recurrencia.${r}`),
              }))}
              ariaLabel={t("adminGastos.add.recurrence")}
              className={selectCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t("adminGastos.add.amount")}</label>
            <MoneyInput
              value={monto}
              onChange={setMonto}
              placeholder="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              {recurrencia === "unico"
                ? t("adminGastos.add.date")
                : t("adminGastos.add.firstCharge")}
            </label>
            <DatePicker
              value={fecha}
              onChange={setFecha}
              className={inputCls}
            />
          </div>
        </div>

        {recurrencia !== "unico" && (
          <div className="border-amethyst-300/20 bg-amethyst-500/[0.06] rounded-lg border p-3">
            <label className={labelCls}>
              {t("adminGastos.add.recurUntil")}
            </label>
            <DatePicker
              value={hasta}
              onChange={setHasta}
              min={fecha || undefined}
              className={inputCls}
            />
            <p className="text-silver-400 mt-2 text-xs">
              {t("adminGastos.add.recurHint")}
            </p>
          </div>
        )}

        <div>
          <label className={labelCls}>{t("adminGastos.add.sede")}</label>
          <SearchableSelect
            value={sede}
            onChange={(v) => setSede(v as SedeId | "")}
            options={[
              { value: "", label: t("adminGastos.add.sedeNone") },
              ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
            ]}
            ariaLabel={t("adminGastos.add.sede")}
            className={selectCls}
          />
        </div>

        <div>
          <label className={labelCls}>{t("adminGastos.add.note")}</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder={t("adminGastos.add.optional")}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div>
          <label className={labelCls}>{t("adminGastos.add.receipt")}</label>
          <label className="text-silver-300 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 px-3 py-2.5 text-sm transition hover:border-white/40 hover:text-white">
            <ImageIcon className="size-4" />
            <span className="truncate">
              {comprobante
                ? comprobante.name
                : t("adminGastos.add.receiptPick")}
            </span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {t("adminGastos.add.error")}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <GlassButton onClick={onClose} disabled={busy}>
          {t("adminGastos.add.cancel")}
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
          {busy ? t("adminGastos.add.submitting") : t("adminGastos.add.submit")}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
