"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpinnerIcon } from "@/components/icons";
import { ANALYTICS_EVENTS } from "@only-g/shared-types/analytics";
import { getAnalitica, updateAnalitica } from "../lib/comercial-config-repo";
import {
  adminCard,
  adminInput,
  adminLabel,
} from "@/features/admin/components/admin-ui";

/** Enlace al informe de la propiedad GA4 (o a la home de GA4 si no hay id). */
function ga4Url(propertyId: string): string {
  return propertyId
    ? `https://analytics.google.com/analytics/web/#/p${propertyId}/`
    : "https://analytics.google.com/";
}

/** Preguntas del CEO → dónde vive la respuesta en GA4 (guía, no deep-links frágiles). */
const GUIA = ["visitas", "dispositivos", "paginas", "eventos", "abandono"];

/**
 * Sección ANALÍTICA del panel CEO. GA4 (Firebase Analytics) YA recolecta toda la
 * métrica (visitas, país, dispositivo, páginas, tiempo, eventos, abandono); no se
 * construye un dashboard in-app (decisión del dueño). Aquí el CEO guarda su ID de
 * propiedad GA4, abre los informes, y tiene una guía de qué informe responde cada
 * pregunta + la lista de eventos propios que la app envía a GA4.
 */
export function CeoAnalitica() {
  const t = useTranslations("ceoAnalitica");
  const [loading, setLoading] = useState(true);
  const [propertyId, setPropertyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    getAnalitica()
      .then((a) => {
        if (!active) return;
        setPropertyId(a.ga4PropertyId ?? "");
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function guardar() {
    setSaving(true);
    setMsg(null);
    try {
      await updateAnalitica(propertyId.trim());
      setMsg({ ok: true, text: t("saved") });
    } catch (e) {
      console.error("[ceo-analitica] save:", e);
      setMsg({ ok: false, text: t("errors.save") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`${adminCard} max-w-2xl p-5 sm:p-6`}>
      <h2 className="font-narrow text-xl font-bold text-white uppercase">
        {t("title")}
      </h2>
      <p className="text-silver-400 mt-1 text-sm">{t("intro")}</p>

      {loading ? (
        <Skeleton className="mt-5 h-10 w-full" />
      ) : (
        <>
          {/* ID de propiedad GA4 (para el enlace directo a tu propiedad). */}
          <div className="mt-5">
            <label htmlFor="ga4Property" className={adminLabel}>
              {t("propertyIdLabel")}
            </label>
            <input
              id="ga4Property"
              type="text"
              inputMode="numeric"
              value={propertyId}
              placeholder={t("propertyIdPlaceholder")}
              onChange={(e) => {
                setPropertyId(e.target.value.replace(/[^\d]/g, ""));
                setMsg(null);
              }}
              className={adminInput}
            />
            <p className="text-silver-500 mt-1 text-xs">{t("propertyIdHint")}</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <GlassButton
              onClick={guardar}
              disabled={saving}
              className="!text-amethyst-200"
            >
              {saving && <SpinnerIcon className="size-4 animate-spin" />}
              {t("save")}
            </GlassButton>
            <a
              href={ga4Url(propertyId.trim())}
              target="_blank"
              rel="noreferrer"
              className="border-amethyst-300/40 text-amethyst-100 hover:border-amethyst-300/70 hover:bg-amethyst-500/10 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm tracking-[2px] uppercase transition"
            >
              {t("openGa4")}
            </a>
            {msg && (
              <span
                className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}
              >
                {msg.text}
              </span>
            )}
          </div>

          {/* Guía: qué informe de GA4 responde cada pregunta. */}
          <div className="mt-6">
            <h3 className="text-silver-300 text-xs font-semibold tracking-wide uppercase">
              {t("guia.title")}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {GUIA.map((k) => (
                <li key={k} className="text-sm">
                  <span className="font-semibold text-white">
                    {t(`guia.${k}.q`)}
                  </span>
                  <span className="text-silver-400"> — {t(`guia.${k}.r`)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Eventos propios que la app envía a GA4 (aparecen en el informe Eventos). */}
          <div className="mt-6">
            <h3 className="text-silver-300 text-xs font-semibold tracking-wide uppercase">
              {t("eventos.title")}
            </h3>
            <p className="text-silver-500 mt-1 text-xs">{t("eventos.desc")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ANALYTICS_EVENTS.map((ev) => (
                <code
                  key={ev}
                  className="text-amethyst-100 rounded bg-white/[0.06] px-2 py-0.5 text-xs ring-1 ring-white/10 ring-inset"
                >
                  {ev}
                </code>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
