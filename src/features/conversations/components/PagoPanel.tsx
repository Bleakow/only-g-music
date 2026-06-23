"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import { formatCOP } from "@/domain/service";
import type { Conversation } from "@/domain/conversation";
import {
  marcarComprobanteEnRevision,
  sendConversationMessage,
  confirmarPago,
} from "../lib/conversations-repo";
import { metodoPagoInfo } from "../data/payment-methods";

/**
 * Panel del chat de PAGO (premium). Renderiza la fase según `pago.estado`:
 *  - comprobante_pendiente: datos del método + subir comprobante (cliente).
 *  - en_revision: aviso "admin revisando"; si es admin, botón de confirmar.
 *  - confirmado: nada (el mensaje `pago_confirmado` ya lo refleja en el hilo).
 * La activación del premium y el cierre del hilo son server-authoritative
 * (Cloud Function confirmPayment); aquí solo se disparan las acciones.
 */
export function PagoPanel({
  conversation,
  uid,
  isAdmin,
}: {
  conversation: Conversation;
  uid: string | undefined;
  isAdmin: boolean;
}) {
  const t = useTranslations();
  const [comprobante, setComprobante] = useState<UploadedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pago = conversation.pago;
  if (!pago) return null;

  const montoFmt = formatCOP(pago.monto);
  const metodoLabel = pago.metodo ? t(`chat.metodos.${pago.metodo}`) : "";
  const info = pago.metodo ? metodoPagoInfo(pago.metodo) : undefined;

  async function enviarComprobante() {
    if (!comprobante[0] || !uid) return;
    setBusy(true);
    setError(null);
    try {
      await sendConversationMessage(conversation.id, {
        from: uid,
        tipo: "comprobante",
        texto: t("pago.receiptSent"),
        attachmentUrl: comprobante[0].url,
        attachmentName: comprobante[0].name,
      });
      await marcarComprobanteEnRevision(conversation.id);
      setComprobante([]);
    } catch (e) {
      console.error("[pago] comprobante:", e);
      setError(t("pago.startError"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmar() {
    setBusy(true);
    setError(null);
    try {
      await confirmarPago(conversation.id);
    } catch (e) {
      console.error("[pago] confirmar:", e);
      setError(t("pago.confirmError"));
    } finally {
      setBusy(false);
    }
  }

  // Comprobante pendiente: instrucciones + subida (cliente). El admin no sube.
  if (pago.estado === "comprobante_pendiente" && !isAdmin) {
    return (
      <section className="rounded-xl border border-amethyst-300/30 bg-amethyst-500/5 p-4">
        <p className="font-semibold text-white">
          {t("pago.payWith", { monto: montoFmt, metodo: metodoLabel })}
        </p>
        {info?.datos && (
          <p className="mt-1 text-sm text-silver-200">{info.datos}</p>
        )}
        {info?.qrUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.qrUrl}
            alt={metodoLabel}
            className="mt-3 size-40 rounded-lg object-contain"
          />
        )}
        <p className="mt-2 text-xs text-silver-400">{t("pago.instructions")}</p>
        <div className="mt-3">
          <FileUpload
            value={comprobante}
            onChange={setComprobante}
            accept="image/*,application/pdf"
          />
        </div>
        <Button
          className="mt-3"
          onClick={enviarComprobante}
          loading={busy}
          disabled={comprobante.length === 0}
        >
          {t("pago.uploadReceipt")}
        </Button>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </section>
    );
  }

  // En revisión: aviso al cliente; botón de confirmar para el admin.
  if (pago.estado === "en_revision") {
    return (
      <section className="rounded-xl border border-sky-400/30 bg-sky-400/10 p-4 text-sm">
        <p className="text-sky-100">{t("pago.reviewing")}</p>
        {isAdmin && (
          <>
            <Button className="mt-3" onClick={confirmar} loading={busy}>
              {t("pago.confirmButton", { monto: montoFmt })}
            </Button>
            {error && <p className="mt-2 text-red-300">{error}</p>}
          </>
        )}
      </section>
    );
  }

  return null;
}
