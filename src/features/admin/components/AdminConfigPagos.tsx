"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GlassButton } from "@/components/ui/GlassButton";
import { SpinnerIcon } from "@/components/icons";
import type { DestinoPago } from "@/domain/payment-destination";
import {
  getCompanyPaymentDest,
  setCompanyPaymentDest,
} from "@/features/conversations/lib/payment-config-repo";
import { DestinoPagoFields } from "./DestinoPagoFields";

/**
 * Datos de pago por DEFECTO de la compañía (SOLO admin) — el destino que ve el
 * cliente en el chat de pago (`config/payments`, un doc singleton). El override
 * por sede se edita en /admin/estudios. Los campos vacíos no se guardan.
 */
export function AdminConfigPagos() {
  const t = useTranslations();
  const [form, setForm] = useState<DestinoPago>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCompanyPaymentDest()
      .then((d) => {
        if (!active) return;
        setForm(d);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[admin-config-pagos] load:", e);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function patch(p: Partial<DestinoPago>) {
    setForm((prev) => ({ ...prev, ...p }));
    setSaved(false);
  }

  async function guardar() {
    setSaving(true);
    setError(null);
    try {
      const clean: DestinoPago = {
        telefono: form.telefono?.trim() || undefined,
        paypal: form.paypal?.trim() || undefined,
        correo: form.correo?.trim() || undefined,
        qrUrl: form.qrUrl || undefined,
        nota: form.nota?.trim() || undefined,
      };
      await setCompanyPaymentDest(clean);
      setSaved(true);
    } catch (e) {
      console.error("[admin-config-pagos] save:", e);
      setError(t("adminConfigPagos.errorSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pt-28 pb-24 sm:px-12">
      <Link
        href="/admin"
        className="text-silver-300 text-sm underline-offset-4 hover:text-white hover:underline"
      >
        {t("adminConfigPagos.backToAdmin")}
      </Link>

      <h1 className="font-narrow mt-4 text-5xl font-bold uppercase sm:text-6xl">
        {t("adminConfigPagos.title")}
      </h1>
      <p className="text-silver-300 mt-2 max-w-xl">
        {t("adminConfigPagos.intro")}
      </p>

      {loading ? (
        <p className="text-silver-300 mt-10">{t("common.loading")}</p>
      ) : (
        <div className="mt-8">
          <DestinoPagoFields value={form} onChange={patch} onError={setError} />

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <GlassButton
              onClick={guardar}
              disabled={saving}
              className="!text-amethyst-200"
            >
              {saving && <SpinnerIcon className="size-4 animate-spin" />}
              {t("adminConfigPagos.save")}
            </GlassButton>
            {saved && (
              <span className="text-sm text-emerald-300">
                {t("adminConfigPagos.saved")}
              </span>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
