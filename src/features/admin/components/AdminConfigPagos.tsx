"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import { SpinnerIcon } from "@/components/icons";
import type { DestinoPago } from "@/domain/payment-destination";
import {
  getCompanyPaymentDest,
  setCompanyPaymentDest,
} from "@/features/conversations/lib/payment-config-repo";
import { DestinoPagoFields } from "./DestinoPagoFields";
import { AdminPageHeader, adminCard } from "./admin-ui";
import { Skeleton } from "@/components/ui/Skeleton";

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
    <main className="pb-24">
      <AdminPageHeader
        eyebrow={t("adminDashboard.eyebrow")}
        title={t("adminConfigPagos.title")}
        subtitle={t("adminConfigPagos.intro")}
      />

      <div className="px-6 sm:px-10">
        {loading ? (
          <div className={`${adminCard} max-w-2xl p-5 sm:p-6`}>
            <div className="space-y-4">
              <div>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-1 h-10 w-full" />
              </div>
              <div>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-1 h-10 w-full" />
              </div>
              <div>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-1 h-10 w-full" />
              </div>
              <div>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-1 h-16 w-full" />
              </div>
              <div>
                <Skeleton className="h-3 w-12" />
                <Skeleton className="mt-1 aspect-square w-full max-w-48" />
              </div>
            </div>
            <Skeleton className="mt-4 h-10 w-32" />
          </div>
        ) : (
          <div className={`${adminCard} max-w-2xl p-5 sm:p-6`}>
            <DestinoPagoFields
              value={form}
              onChange={patch}
              onError={setError}
            />

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
      </div>
    </main>
  );
}
