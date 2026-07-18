"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CopyIcon, CheckIcon } from "@/components/icons";
import { formatCOP } from "@only-g/shared-types/service";
import type { Conversation } from "@only-g/shared-types/conversation";
import type { DestinoPago } from "@only-g/shared-types/payment-destination";
import { instruccionPago, resolverDestinoPago } from "@only-g/shared-types/payment-destination";
import { getReservaById } from "@/features/booking/lib/booking-repo";
import { getSedeById } from "@/features/sedes/lib/sedes-repo";
import {
  marcarComprobanteEnRevision,
  sendConversationMessage,
  confirmarPago,
} from "../lib/conversations-repo";
import { getCompanyPaymentDest } from "../lib/payment-config-repo";

/**
 * Panel del chat de PAGO (premium/reserva). Renderiza la fase según `pago.estado`:
 *  - comprobante_pendiente: destino de pago (dato + QR + copiar) + subir comprobante.
 *  - en_revision: aviso "admin revisando"; si es admin, botón de confirmar.
 *  - confirmado: nada (el mensaje `pago_confirmado` lo refleja en el hilo).
 * La confirmación y el cierre del hilo son server-authoritative (confirmPayment).
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
  const [destino, setDestino] = useState<DestinoPago>({});
  const [copied, setCopied] = useState(false);

  const refKind = conversation.ref?.kind;
  const refId = conversation.ref?.id;

  // Destino de pago: default de la compañía, o el override de la sede si el pago
  // es de una reserva (resolverDestinoPago = override ?? default).
  useEffect(() => {
    let active = true;
    async function resolver(): Promise<DestinoPago> {
      const company = await getCompanyPaymentDest();
      if (refKind === "booking" && refId) {
        const reserva = await getReservaById(refId);
        if (reserva) {
          const sede = await getSedeById(reserva.sede);
          return resolverDestinoPago(sede?.pago, company);
        }
      }
      return company;
    }
    resolver()
      .then((d) => {
        if (active) setDestino(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refKind, refId]);

  const pago = conversation.pago;
  if (!pago) return null;

  const montoFmt = formatCOP(pago.monto);
  const metodoLabel = pago.metodo ? t(`chat.metodos.${pago.metodo}`) : "";
  const instr = pago.metodo ? instruccionPago(pago.metodo, destino) : null;

  async function copiar(valor?: string) {
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sin clipboard: el usuario copia a mano */
    }
  }

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

  // Comprobante pendiente: destino de pago + subida (cliente). El admin no sube.
  if (pago.estado === "comprobante_pendiente" && !isAdmin) {
    const sinDatos = !instr?.valor && !instr?.qrUrl && !instr?.nota;
    return (
      <section className="rounded-xl border border-amethyst-300/30 bg-amethyst-500/5 p-4">
        <p className="font-semibold text-white">
          {t("pago.payWith", { monto: montoFmt, metodo: metodoLabel })}
        </p>

        {instr?.valor && (
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-sm text-silver-100">
              {instr.valor}
            </span>
            <button
              type="button"
              onClick={() => copiar(instr?.valor)}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs text-silver-200 transition hover:border-amethyst-300/60 hover:text-white"
            >
              {copied ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
              {copied ? t("pago.copied") : t("pago.copy")}
            </button>
          </div>
        )}

        {instr?.qrUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={instr.qrUrl}
            alt={metodoLabel}
            className="mt-3 size-40 rounded-lg object-contain"
          />
        )}

        {instr?.nota && (
          <p className="mt-2 text-sm text-silver-200">{instr.nota}</p>
        )}

        {sinDatos && (
          <p className="mt-2 text-sm text-silver-300">{t("pago.noInfo")}</p>
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
        {error && <Alert tone="error" className="mt-2">{error}</Alert>}
      </section>
    );
  }

  // En revisión: aviso al cliente; botón de confirmar para el admin.
  if (pago.estado === "en_revision") {
    return (
      <section className="text-sm">
        <Alert tone="info">{t("pago.reviewing")}</Alert>
        {isAdmin && (
          <>
            <Button className="mt-3" onClick={confirmar} loading={busy}>
              {t("pago.confirmButton", { monto: montoFmt })}
            </Button>
            {error && <Alert tone="error" className="mt-2">{error}</Alert>}
          </>
        )}
      </section>
    );
  }

  return null;
}
