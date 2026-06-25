"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { SpinnerIcon, CheckIcon, ImageIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { uploadUserFile } from "@/features/uploads/lib/uploads-repo";
import {
  type NuevoActivo,
  type ActivoCategoria,
  ACTIVO_CATEGORIAS,
} from "@/domain/contabilidad";
import type { SedeId } from "@/domain/sede";
import { addActivo } from "../lib/activos-repo";

const SEDES: SedeId[] = ["barranquilla", "bogota"];

const inputCls =
  "w-full rounded-lg bg-white/[0.06] px-3 py-2 text-white outline-none ring-1 ring-inset ring-white/20 transition focus:ring-white/50 placeholder:text-white/40";
const labelCls = "mb-1 block text-xs uppercase tracking-wide text-silver-400";

/** epoch ms → "YYYY-MM-DD" para <input type="date">. */
function toDateInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Alta de un bien/activo fijo. Sube la foto (opcional) a Storage y persiste el
 * activo vía `activos-repo` (server pone createdBy/createdAt). El valor en libros
 * y la depreciación NO se piden: se derivan de vida útil + valor residual.
 */
export function AddActivoModal({
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
  const [categoria, setCategoria] =
    useState<ActivoCategoria>("equipo_produccion");
  const [valor, setValor] = useState("");
  const [fecha, setFecha] = useState(() => toDateInput(Date.now()));
  const [sede, setSede] = useState<SedeId | "">("");
  const [vidaUtil, setVidaUtil] = useState("");
  const [residual, setResidual] = useState("");
  const [nota, setNota] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const valorNum = Number(valor);
  const valido = nombre.trim() !== "" && valorNum > 0 && fecha !== "" && !!user;

  function reset() {
    setNombre("");
    setCategoria("equipo_produccion");
    setValor("");
    setFecha(toDateInput(Date.now()));
    setSede("");
    setVidaUtil("");
    setResidual("");
    setNota("");
    setFoto(null);
  }

  async function guardar() {
    if (!valido || !user || busy) return;
    setBusy(true);
    setError(false);
    try {
      const fotoUrl = foto ? (await uploadUserFile(user.uid, foto)).url : undefined;
      const nuevo: NuevoActivo = {
        nombre: nombre.trim(),
        categoria,
        valorAdquisicion: valorNum,
        fechaAdquisicion: new Date(fecha).getTime(),
        fotoUrl,
        sede: sede || undefined,
        vidaUtilMeses: vidaUtil ? Number(vidaUtil) : undefined,
        valorResidual: residual ? Number(residual) : undefined,
        nota: nota.trim() || undefined,
      };
      await addActivo(nuevo, user.uid);
      reset();
      onCreated();
    } catch (e) {
      console.error("[bienes] addActivo:", e);
      setError(true);
      setBusy(false);
    }
  }

  return (
    <GlassModal
      open={open}
      onClose={() => !busy && onClose()}
      title={t("adminBienes.add.title")}
      className="max-w-lg"
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <div>
          <label className={labelCls}>{t("adminBienes.add.name")}</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={t("adminBienes.add.namePlaceholder")}
            autoFocus
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t("adminBienes.add.category")}</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as ActivoCategoria)}
              className={inputCls}
            >
              {ACTIVO_CATEGORIAS.map((c) => (
                <option key={c} value={c} className="bg-ink text-white">
                  {t(`adminBienes.categoria.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("adminBienes.add.sede")}</label>
            <select
              value={sede}
              onChange={(e) => setSede(e.target.value as SedeId | "")}
              className={inputCls}
            >
              <option value="" className="bg-ink text-white">
                {t("adminBienes.add.sedeNone")}
              </option>
              {SEDES.map((s) => (
                <option key={s} value={s} className="bg-ink text-white">
                  {t(`adminBienes.sedes.${s}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>
              {t("adminBienes.add.acquisitionValue")}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              {t("adminBienes.add.acquisitionDate")}
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>
              {t("adminBienes.add.usefulLife")}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={vidaUtil}
              onChange={(e) => setVidaUtil(e.target.value)}
              placeholder={t("adminBienes.add.optional")}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              {t("adminBienes.add.residualValue")}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={residual}
              onChange={(e) => setResidual(e.target.value)}
              placeholder={t("adminBienes.add.optional")}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>{t("adminBienes.add.note")}</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder={t("adminBienes.add.optional")}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div>
          <label className={labelCls}>{t("adminBienes.add.photo")}</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 px-3 py-2.5 text-sm text-silver-300 transition hover:border-white/40 hover:text-white">
            <ImageIcon className="size-4" />
            <span className="truncate">
              {foto ? foto.name : t("adminBienes.add.photoPick")}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {t("adminBienes.add.error")}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <GlassButton onClick={onClose} disabled={busy}>
          {t("adminBienes.add.cancel")}
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
          {busy ? t("adminBienes.add.submitting") : t("adminBienes.add.submit")}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
