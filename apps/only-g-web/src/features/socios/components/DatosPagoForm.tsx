"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpinnerIcon, CheckIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/components/AuthProvider";
import {
  type MetodoPagoSocio,
  type TipoCuenta,
  type TipoDoc,
  type NuevoDatosPago,
  METODOS_PAGO_SOCIO,
  TIPOS_CUENTA,
  TIPOS_DOC,
  datosPagoCompletos,
} from "@/domain/datos-pago";
import { getDatosPago, updateDatosPago } from "../lib/datos-pago-repo";

// Estilo de campo/etiqueta del sitio (no-admin), alineado con /cuenta.
const INPUT =
  "w-full rounded-lg bg-white/[0.06] px-3 py-2 text-white outline-none ring-1 ring-inset ring-white/20 transition focus:ring-white/50 placeholder:text-white/40";
const LABEL =
  "text-silver-300 mb-1.5 block text-xs font-semibold tracking-[1px] uppercase";
const SELECT = `flex w-full items-center justify-between gap-2 ${INPUT}`;

/**
 * Captura y edita los datos de pago del socio (a dónde le paga Only G). Toda la
 * data-access va por `datos-pago-repo`; este componente solo orquesta el
 * formulario. Reutilizable: se monta en /cuenta (socios) y en /convenio/enviado
 * (prompt opcional). Datos SENSIBLES: nunca se loguean.
 */
export function DatosPagoForm({ onSaved }: { onSaved?: () => void }) {
  const t = useTranslations();
  const { user } = useAuth();

  const [metodo, setMetodo] = useState<MetodoPagoSocio>("banco");
  // Banco
  const [entidad, setEntidad] = useState("");
  const [tipoCuenta, setTipoCuenta] = useState<TipoCuenta>("ahorros");
  const [numeroCuenta, setNumeroCuenta] = useState("");
  const [titularBanco, setTitularBanco] = useState("");
  const [tipoDoc, setTipoDoc] = useState<TipoDoc>("CC");
  const [numeroDoc, setNumeroDoc] = useState("");
  // Nequi
  const [telefono, setTelefono] = useState("");
  const [titularNequi, setTitularNequi] = useState("");
  // Efectivo
  const [nota, setNota] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Al montar: sembrar con lo ya guardado (si existe).
  useEffect(() => {
    if (!user) return;
    let active = true;
    getDatosPago(user.uid)
      .then((d) => {
        if (!active) return;
        if (d) {
          setMetodo(d.metodo);
          if (d.banco) {
            setEntidad(d.banco.entidad);
            setTipoCuenta(d.banco.tipoCuenta);
            setNumeroCuenta(d.banco.numeroCuenta);
            setTitularBanco(d.banco.titular);
            setTipoDoc(d.banco.tipoDoc);
            setNumeroDoc(d.banco.numeroDoc);
          }
          if (d.nequi) {
            setTelefono(d.nequi.telefono);
            setTitularNequi(d.nequi.titular);
          }
          if (d.efectivo) setNota(d.efectivo.nota ?? "");
        }
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  /** Marca el formulario como sucio (limpia el "guardado" tras editar). */
  function markDirty() {
    if (saved) setSaved(false);
    if (error) setError(null);
  }

  function buildPayload(): NuevoDatosPago {
    if (metodo === "banco") {
      return {
        metodo,
        banco: {
          entidad: entidad.trim(),
          tipoCuenta,
          numeroCuenta: numeroCuenta.trim(),
          titular: titularBanco.trim(),
          tipoDoc,
          numeroDoc: numeroDoc.trim(),
        },
      };
    }
    if (metodo === "nequi") {
      return {
        metodo,
        nequi: { telefono: telefono.trim(), titular: titularNequi.trim() },
      };
    }
    const notaTrim = nota.trim();
    return { metodo, efectivo: notaTrim ? { nota: notaTrim } : {} };
  }

  async function onSave() {
    if (!user || busy) return;
    const payload = buildPayload();
    if (!datosPagoCompletos({ ...payload, updatedAt: 0 })) {
      setError(t("datosPago.incomplete"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateDatosPago(user.uid, payload);
      setSaved(true);
      onSaved?.();
    } catch (e) {
      // Solo el error, NUNCA el payload (contiene el número de cuenta).
      console.error("[datos-pago] save:", e);
      setError(t("datosPago.error"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-2/3 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Selector de método (segmentado) */}
      <div>
        <span className={LABEL}>{t("datosPago.method")}</span>
        <div className="flex flex-wrap gap-2">
          {METODOS_PAGO_SOCIO.map((m) => {
            const active = m === metodo;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMetodo(m);
                  markDirty();
                }}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-sm font-semibold tracking-wide uppercase transition ${
                  active
                    ? "border-amethyst-300/50 bg-amethyst-500/20 text-amethyst-100"
                    : "border-white/15 bg-white/[0.04] text-silver-300 hover:border-white/30 hover:text-white"
                }`}
              >
                {t(`datosPago.metodo.${m}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Campos condicionales según método */}
      {metodo === "banco" && (
        <div className="space-y-4">
          <div>
            <label className={LABEL}>{t("datosPago.banco.entidad")}</label>
            <input
              value={entidad}
              onChange={(e) => {
                setEntidad(e.target.value);
                markDirty();
              }}
              placeholder={t("datosPago.banco.entidadPlaceholder")}
              className={INPUT}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>{t("datosPago.banco.tipoCuenta")}</label>
              <SearchableSelect
                value={tipoCuenta}
                onChange={(v) => {
                  setTipoCuenta(v as TipoCuenta);
                  markDirty();
                }}
                options={TIPOS_CUENTA.map((c) => ({
                  value: c,
                  label: t(`datosPago.tipoCuenta.${c}`),
                }))}
                ariaLabel={t("datosPago.banco.tipoCuenta")}
                className={SELECT}
              />
            </div>
            <div>
              <label className={LABEL}>
                {t("datosPago.banco.numeroCuenta")}
              </label>
              <input
                value={numeroCuenta}
                onChange={(e) => {
                  setNumeroCuenta(e.target.value);
                  markDirty();
                }}
                inputMode="numeric"
                placeholder={t("datosPago.banco.numeroCuentaPlaceholder")}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>{t("datosPago.banco.titular")}</label>
            <input
              value={titularBanco}
              onChange={(e) => {
                setTitularBanco(e.target.value);
                markDirty();
              }}
              placeholder={t("datosPago.banco.titularPlaceholder")}
              className={INPUT}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>{t("datosPago.banco.tipoDoc")}</label>
              <SearchableSelect
                value={tipoDoc}
                onChange={(v) => {
                  setTipoDoc(v as TipoDoc);
                  markDirty();
                }}
                options={TIPOS_DOC.map((d) => ({
                  value: d,
                  label: t(`datosPago.tipoDoc.${d}`),
                }))}
                ariaLabel={t("datosPago.banco.tipoDoc")}
                className={SELECT}
              />
            </div>
            <div>
              <label className={LABEL}>{t("datosPago.banco.numeroDoc")}</label>
              <input
                value={numeroDoc}
                onChange={(e) => {
                  setNumeroDoc(e.target.value);
                  markDirty();
                }}
                inputMode="numeric"
                placeholder={t("datosPago.banco.numeroDocPlaceholder")}
                className={INPUT}
              />
            </div>
          </div>
        </div>
      )}

      {metodo === "nequi" && (
        <div className="space-y-4">
          <div>
            <label className={LABEL}>{t("datosPago.nequi.telefono")}</label>
            <input
              value={telefono}
              onChange={(e) => {
                setTelefono(e.target.value);
                markDirty();
              }}
              inputMode="tel"
              placeholder={t("datosPago.nequi.telefonoPlaceholder")}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>{t("datosPago.nequi.titular")}</label>
            <input
              value={titularNequi}
              onChange={(e) => {
                setTitularNequi(e.target.value);
                markDirty();
              }}
              placeholder={t("datosPago.nequi.titularPlaceholder")}
              className={INPUT}
            />
          </div>
        </div>
      )}

      {metodo === "efectivo" && (
        <div className="space-y-3">
          <div>
            <label className={LABEL}>{t("datosPago.efectivo.nota")}</label>
            <textarea
              value={nota}
              onChange={(e) => {
                setNota(e.target.value);
                markDirty();
              }}
              rows={2}
              placeholder={t("datosPago.efectivo.notaPlaceholder")}
              className={`${INPUT} resize-none`}
            />
          </div>
          <p className="text-silver-400 text-xs">
            {t("datosPago.efectivo.hint")}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}
      {saved && (
        <p className="text-sm text-emerald-300">{t("datosPago.saved")}</p>
      )}

      <div className="flex justify-end">
        <GlassButton onClick={onSave} disabled={busy}>
          {busy ? (
            <SpinnerIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          {busy ? t("datosPago.saving") : t("datosPago.save")}
        </GlassButton>
      </div>
    </div>
  );
}
