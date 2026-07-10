"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { SpinnerIcon, CheckIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/components/AuthProvider";
import {
  type NuevoPasivo,
  type PasivoCategoria,
  PASIVO_CATEGORIAS,
} from "@/domain/contabilidad";
import type { SedeId } from "@/domain/sede";
import { addPasivo } from "../lib/pasivos-repo";
import { adminInput, adminLabel } from "./admin-ui";

const SEDES: SedeId[] = ["barranquilla", "bogota"];

const inputCls = adminInput;
const labelCls = adminLabel;

/** epoch ms → "YYYY-MM-DD" para <input type="date">. */
function toDateInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Registro de un pasivo (deuda/obligación). Persiste vía `pasivos-repo`. */
export function AddPasivoModal({
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
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<PasivoCategoria>("prestamo");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => toDateInput(Date.now()));
  const [acreedor, setAcreedor] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [sede, setSede] = useState<SedeId | "">("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const montoNum = Number(monto);
  const valido = nombre.trim() !== "" && montoNum > 0 && fecha !== "" && !!user;

  function reset() {
    setNombre("");
    setCategoria("prestamo");
    setMonto("");
    setFecha(toDateInput(Date.now()));
    setAcreedor("");
    setVencimiento("");
    setSede("");
    setNota("");
  }

  async function guardar() {
    if (!valido || !user || busy) return;
    setBusy(true);
    setError(false);
    try {
      const nuevo: NuevoPasivo = {
        nombre: nombre.trim(),
        categoria,
        monto: montoNum,
        fecha: new Date(fecha).getTime(),
        acreedor: acreedor.trim() || undefined,
        vencimiento: vencimiento ? new Date(vencimiento).getTime() : undefined,
        sede: sede || undefined,
        nota: nota.trim() || undefined,
      };
      await addPasivo(nuevo, user.uid);
      reset();
      onCreated();
    } catch (e) {
      console.error("[pasivos] addPasivo:", e);
      setError(true);
      setBusy(false);
    }
  }

  return (
    <GlassModal
      open={open}
      onClose={() => !busy && onClose()}
      title={t("adminBalance.add.title")}
      className="max-w-lg"
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <div>
          <label className={labelCls}>{t("adminBalance.add.name")}</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={t("adminBalance.add.namePlaceholder")}
            autoFocus
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t("adminBalance.add.category")}</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as PasivoCategoria)}
              className={inputCls}
            >
              {PASIVO_CATEGORIAS.map((c) => (
                <option key={c} value={c} className="bg-ink text-white">
                  {t(`adminBalance.categoria.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("adminBalance.add.amount")}</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t("adminBalance.add.date")}</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("adminBalance.add.dueDate")}</label>
            <input
              type="date"
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t("adminBalance.add.creditor")}</label>
            <input
              value={acreedor}
              onChange={(e) => setAcreedor(e.target.value)}
              placeholder={t("adminBalance.add.optional")}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t("adminBalance.add.sede")}</label>
            <select
              value={sede}
              onChange={(e) => setSede(e.target.value as SedeId | "")}
              className={inputCls}
            >
              <option value="" className="bg-ink text-white">
                {t("adminBalance.add.sedeNone")}
              </option>
              {SEDES.map((s) => (
                <option key={s} value={s} className="bg-ink text-white">
                  {t(`adminBienes.sedes.${s}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>{t("adminBalance.add.note")}</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder={t("adminBalance.add.optional")}
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {t("adminBalance.add.error")}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <GlassButton onClick={onClose} disabled={busy}>
          {t("adminBalance.add.cancel")}
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
            ? t("adminBalance.add.submitting")
            : t("adminBalance.add.submit")}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
