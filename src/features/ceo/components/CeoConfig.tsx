"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpinnerIcon } from "@/components/icons";
import {
  esComisionValida,
  esPrecioValido,
  type Comisiones,
} from "@/domain/comercial-config";
import {
  getComercialConfig,
  updateComisiones,
  updatePrecios,
} from "../lib/comercial-config-repo";
import { AdminPageHeader, adminCard, adminInput, adminLabel } from "@/features/admin/components/admin-ui";

/** Fracción 0..1 → texto de porcentaje sin ruido flotante (0.2 → "20", 0.205 → "20.5"). */
function pctText(fraction: number): string {
  return String(Math.round(fraction * 10000) / 100);
}
/** Texto de porcentaje → fracción 0..1 (o NaN si no es número). */
function pctToFraction(text: string): number {
  const n = Number(text);
  return Number.isFinite(n) ? n / 100 : NaN;
}
/** Sanea la entrada de porcentaje: solo dígitos y un punto decimal. */
function sanitizePct(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [ent, ...rest] = cleaned.split(".");
  return rest.length ? `${ent}.${rest.join("")}` : ent;
}

/**
 * Herramienta del CEO: ver/editar la CONFIG COMERCIAL (comisiones internas +
 * precios visibles al comprador). Los valores dejan de ser constantes: el
 * servidor (dinero) y el cliente (display) leen de aquí. Cambiar un valor solo
 * afecta a las ventas/cobros NUEVOS — lo histórico queda congelado con el precio
 * vigente al confirmar. Server-authoritative: este panel no mueve plata, solo
 * cambia parámetros; el clamp de rango vive también en el servidor.
 *
 * Dos secciones = dos documentos (`comercialConfig/comisiones` y `.../precios`)
 * con reglas de lectura distintas; cada una guarda por su lado.
 */
export function CeoConfig() {
  const t = useTranslations("ceoConfig");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Comisiones en % (0..100); comisionProductor puede quedar vacío = "sin definir".
  const [comisionBeat, setComisionBeat] = useState("");
  const [comisionProductor, setComisionProductor] = useState("");
  const [savingComisiones, setSavingComisiones] = useState(false);
  const [comisionesMsg, setComisionesMsg] = useState<
    { ok: boolean; text: string } | null
  >(null);

  // Precios en COP (dígitos crudos, MoneyInput los agrupa al mostrar).
  const [precioBeat, setPrecioBeat] = useState("");
  const [precioMembresia, setPrecioMembresia] = useState("");
  const [precioPerfil, setPrecioPerfil] = useState("");
  const [savingPrecios, setSavingPrecios] = useState(false);
  const [preciosMsg, setPreciosMsg] = useState<
    { ok: boolean; text: string } | null
  >(null);

  useEffect(() => {
    let active = true;
    getComercialConfig()
      .then((cfg) => {
        if (!active) return;
        setComisionBeat(pctText(cfg.comisiones.comisionBeat));
        setComisionProductor(
          cfg.comisiones.comisionProductor !== undefined
            ? pctText(cfg.comisiones.comisionProductor)
            : "",
        );
        setPrecioBeat(String(cfg.precios.precioBeat));
        setPrecioMembresia(String(cfg.precios.precioMembresia));
        setPrecioPerfil(String(cfg.precios.precioPerfil));
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[ceo-config] load:", e);
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function guardarComisiones() {
    setSavingComisiones(true);
    setComisionesMsg(null);
    try {
      const beat = pctToFraction(comisionBeat);
      if (!esComisionValida(beat)) {
        setComisionesMsg({ ok: false, text: t("errors.comisionRango") });
        return;
      }
      const data: Comisiones = { comisionBeat: beat };
      const prodText = comisionProductor.trim();
      if (prodText !== "") {
        const prod = pctToFraction(prodText);
        if (!esComisionValida(prod)) {
          setComisionesMsg({ ok: false, text: t("errors.comisionRango") });
          return;
        }
        data.comisionProductor = prod;
      }
      await updateComisiones(data);
      setComisionesMsg({ ok: true, text: t("saved") });
    } catch (e) {
      console.error("[ceo-config] save comisiones:", e);
      setComisionesMsg({ ok: false, text: t("errors.save") });
    } finally {
      setSavingComisiones(false);
    }
  }

  async function guardarPrecios() {
    setSavingPrecios(true);
    setPreciosMsg(null);
    try {
      const beat = Number(precioBeat);
      const membresia = Number(precioMembresia);
      const perfil = Number(precioPerfil);
      if (
        !esPrecioValido(beat) ||
        !esPrecioValido(membresia) ||
        !esPrecioValido(perfil)
      ) {
        setPreciosMsg({ ok: false, text: t("errors.precioRango") });
        return;
      }
      await updatePrecios({
        precioBeat: beat,
        precioMembresia: membresia,
        precioPerfil: perfil,
      });
      setPreciosMsg({ ok: true, text: t("saved") });
    } catch (e) {
      console.error("[ceo-config] save precios:", e);
      setPreciosMsg({ ok: false, text: t("errors.save") });
    } finally {
      setSavingPrecios(false);
    }
  }

  return (
    <main className="pb-24">
      <AdminPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("intro")}
      />

      <div className="flex flex-col gap-6 px-6 sm:px-10">
        {/* Aviso: los cambios solo afectan a lo NUEVO. */}
        <div className="border-amethyst-300/30 bg-amethyst-500/10 max-w-2xl rounded-2xl border p-4">
          <p className="text-amethyst-100 text-sm">{t("warning")}</p>
        </div>

        {loadError && (
          <p className="max-w-2xl rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {t("errors.load")}
          </p>
        )}

        {loading ? (
          <div className={`${adminCard} max-w-2xl p-5 sm:p-6`}>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="mt-1 h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── Comisiones (internas, solo CEO) ── */}
            <section className={`${adminCard} max-w-2xl p-5 sm:p-6`}>
              <h2 className="font-narrow text-xl font-bold text-white uppercase">
                {t("comisiones.title")}
              </h2>
              <p className="text-silver-400 mt-1 text-sm">
                {t("comisiones.desc")}
              </p>

              <div className="mt-5 flex flex-col gap-4">
                <PctField
                  id="comisionBeat"
                  label={t("comisiones.beat")}
                  hint={t("comisiones.beatHint")}
                  value={comisionBeat}
                  onChange={(v) => {
                    setComisionBeat(sanitizePct(v));
                    setComisionesMsg(null);
                  }}
                />
                <PctField
                  id="comisionProductor"
                  label={t("comisiones.productor")}
                  hint={t("comisiones.productorHint")}
                  value={comisionProductor}
                  placeholder={t("comisiones.sinDefinir")}
                  onChange={(v) => {
                    setComisionProductor(sanitizePct(v));
                    setComisionesMsg(null);
                  }}
                />
              </div>

              <SaveRow
                onSave={guardarComisiones}
                saving={savingComisiones}
                msg={comisionesMsg}
                saveLabel={t("save")}
              />
            </section>

            {/* ── Precios (visibles al comprador) ── */}
            <section className={`${adminCard} max-w-2xl p-5 sm:p-6`}>
              <h2 className="font-narrow text-xl font-bold text-white uppercase">
                {t("precios.title")}
              </h2>
              <p className="text-silver-400 mt-1 text-sm">
                {t("precios.desc")}
              </p>

              <div className="mt-5 flex flex-col gap-4">
                <MoneyField
                  id="precioBeat"
                  label={t("precios.beat")}
                  value={precioBeat}
                  onChange={(v) => {
                    setPrecioBeat(v);
                    setPreciosMsg(null);
                  }}
                />
                <MoneyField
                  id="precioMembresia"
                  label={t("precios.membresia")}
                  value={precioMembresia}
                  onChange={(v) => {
                    setPrecioMembresia(v);
                    setPreciosMsg(null);
                  }}
                />
                <MoneyField
                  id="precioPerfil"
                  label={t("precios.perfil")}
                  value={precioPerfil}
                  onChange={(v) => {
                    setPrecioPerfil(v);
                    setPreciosMsg(null);
                  }}
                />
              </div>

              <SaveRow
                onSave={guardarPrecios}
                saving={savingPrecios}
                msg={preciosMsg}
                saveLabel={t("save")}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function PctField({
  id,
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={adminLabel}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${adminInput} pr-9`}
        />
        <span className="text-silver-400 pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
          %
        </span>
      </div>
      {hint && <p className="text-silver-500 mt-1 text-xs">{hint}</p>}
    </div>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={adminLabel}>
        {label}
      </label>
      <div className="relative">
        <span className="text-silver-400 pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">
          $
        </span>
        <MoneyInput
          id={id}
          value={value}
          onChange={onChange}
          className={`${adminInput} pl-7`}
        />
      </div>
    </div>
  );
}

function SaveRow({
  onSave,
  saving,
  msg,
  saveLabel,
}: {
  onSave: () => void;
  saving: boolean;
  msg: { ok: boolean; text: string } | null;
  saveLabel: string;
}) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <GlassButton
        onClick={onSave}
        disabled={saving}
        className="!text-amethyst-200"
      >
        {saving && <SpinnerIcon className="size-4 animate-spin" />}
        {saveLabel}
      </GlassButton>
      {msg && (
        <span
          className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}
        >
          {msg.text}
        </span>
      )}
    </div>
  );
}
