"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { Alert } from "@/components/ui/Alert";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { SpinnerIcon, CheckIcon } from "@/components/icons";
import { formatCOP } from "@/domain/service";
import { METODOS_PAGO_SOCIO } from "@/domain/datos-pago";
import type { MetodoLiquidacion } from "../lib/payouts-repo";

/**
 * Modal de LIQUIDACIÓN de un payout (o del "pagar todo" de una persona). PURO de
 * presentación: elige método (prefill con el de los datos de pago del socio) y
 * adjunta un comprobante OPCIONAL (se sube a Storage vía `FileUpload`), luego
 * delega en `onConfirm`. Toda la lógica de negocio (llamar a la Cloud Function +
 * update optimista) vive en el panel, no aquí. Si `onConfirm` resuelve, cierra; si
 * rechaza, muestra el error y NO cierra (la fila no debe saltar de sección).
 */
export function PayoutPagoModal({
  open,
  onClose,
  title,
  monto,
  defaultMetodo,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  /** Contexto de a quién se le paga (nombre del socio). */
  title: string;
  /** Total en COP que se va a liquidar (informativo). */
  monto: number;
  /** Método sugerido (el que el socio dejó en sus datos de pago). */
  defaultMetodo: MetodoLiquidacion;
  onConfirm: (
    metodo: MetodoLiquidacion,
    comprobanteUrl?: string,
  ) => Promise<void>;
}) {
  const t = useTranslations();
  const [metodo, setMetodo] = useState<MetodoLiquidacion>(defaultMetodo);
  const [comprobante, setComprobante] = useState<UploadedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);

  // Al (re)abrir: resetear al método sugerido y limpiar comprobante/estado. El
  // modal se reutiliza para distintos targets, así que no debe arrastrar estado.
  useEffect(() => {
    if (!open) return;
    setMetodo(defaultMetodo);
    setComprobante([]);
    setBusy(false);
    setUploading(false);
    setError(false);
  }, [open, defaultMetodo]);

  async function confirmar() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await onConfirm(metodo, comprobante[0]?.url);
      onClose();
    } catch (e) {
      // Solo el error, nunca el comprobante ni el método (higiene de datos).
      console.error("[admin-payouts] registrarPago:", e);
      setError(true);
      setBusy(false);
    }
  }

  return (
    <GlassModal
      open={open}
      onClose={() => !busy && onClose()}
      title={t("adminPayouts.modal.title")}
      className="max-w-md"
    >
      <div className="flex flex-col gap-5">
        <p className="text-silver-200 text-sm">
          {t("adminPayouts.modal.para", { nombre: title })}{" "}
          <span className="font-semibold text-white">{formatCOP(monto)}</span>
        </p>

        {/* Método (segmentado, prefill con el de los datos de pago del socio) */}
        <div>
          <span className="text-silver-400 mb-1.5 block text-xs tracking-wide uppercase">
            {t("datosPago.method")}
          </span>
          <div className="flex flex-wrap gap-2">
            {METODOS_PAGO_SOCIO.map((m) => {
              const active = m === metodo;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodo(m)}
                  aria-pressed={active}
                  disabled={busy}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold tracking-wide uppercase transition disabled:opacity-60 ${
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

        {/* Comprobante OPCIONAL (imagen/PDF de la transferencia) */}
        <div>
          <span className="text-silver-400 mb-1.5 block text-xs tracking-wide uppercase">
            {t("adminPayouts.modal.comprobante")}
          </span>
          <FileUpload
            value={comprobante}
            onChange={setComprobante}
            onBusyChange={setUploading}
            accept="image/*,application/pdf"
          />
          <p className="text-silver-500 mt-1.5 text-xs">
            {t("adminPayouts.modal.comprobanteHint")}
          </p>
        </div>

        {error && <Alert tone="error">{t("adminPayouts.modal.error")}</Alert>}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <GlassButton onClick={onClose} disabled={busy}>
          {t("adminPayouts.modal.cancelar")}
        </GlassButton>
        <GlassButton
          onClick={confirmar}
          disabled={busy || uploading}
          className="!text-emerald-200"
        >
          {busy || uploading ? (
            <SpinnerIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          {uploading
            ? t("adminPayouts.modal.subiendo")
            : busy
              ? t("adminPayouts.modal.confirmando")
              : t("adminPayouts.modal.confirmar")}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
