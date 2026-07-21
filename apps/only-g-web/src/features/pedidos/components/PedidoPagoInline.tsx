"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CopyIcon, CheckIcon, KeyIcon } from "@/components/icons";
import { glassSurface, GlassSheen } from "@/components/ui/glass";
import { formatCOP } from "@only-g/shared-types/service";
import type { MetodoPago } from "@only-g/shared-types/payment-method";
import type { DestinoPago } from "@only-g/shared-types/payment-destination";
import {
  instruccionPago,
  resolverDestinoPago,
} from "@only-g/shared-types/payment-destination";
import type { SedeId } from "@only-g/shared-types/sede";
import { PaymentMethodPicker } from "@/features/conversations/components/PaymentMethodPicker";
import { PaymentQr } from "@/features/conversations/components/PaymentQr";
import { getCompanyPaymentDest } from "@/features/conversations/lib/payment-config-repo";
import { getSedeById } from "@/features/sedes/lib/sedes-repo";
import {
  createPaymentConversation,
  sendConversationMessage,
  marcarComprobanteEnRevision,
} from "@/features/conversations/lib/conversations-repo";
import { openConversation } from "@/features/conversations/lib/open-conversation";

const COPY_CHIP =
  "inline-flex min-h-11 items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs text-silver-200 transition hover:border-amethyst-300/60 hover:text-white";

/**
 * Cierre de la compra: panel de pago INLINE. "Ir a pagar" → elige método → QR +
 * llave Bre-B + subir comprobante, en la misma pantalla. El método se puede
 * cambiar (reabre el selector). Al enviar el comprobante crea el chat de pago del
 * pedido, manda la imagen y avisa al admin (que acepta/rechaza en el chat).
 */
export function PedidoPagoInline({
  pedidoId,
  total,
  uid,
  sede,
}: {
  pedidoId: string;
  total: number;
  uid: string;
  /** Sede del pedido: su destino de pago (QR propio) gana sobre el de la compañía. */
  sede: SedeId;
}) {
  const t = useTranslations();
  const [destino, setDestino] = useState<DestinoPago>({});
  const [showPicker, setShowPicker] = useState(false);
  const [metodo, setMetodo] = useState<MetodoPago | null>(null);
  const [comprobante, setComprobante] = useState<UploadedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedBreB, setCopiedBreB] = useState(false);

  // Destino de pago: override de la sede si lo tiene, si no el default de la
  // compañía (misma política que PagoPanel: resolverDestinoPago(sede ?? company)).
  useEffect(() => {
    let active = true;
    (async () => {
      const company = await getCompanyPaymentDest();
      let dest = company;
      try {
        const sedeDoc = await getSedeById(sede);
        dest = resolverDestinoPago(sedeDoc?.pago, company);
      } catch {
        /* sin sede: se queda el default de la compañía */
      }
      if (active) setDestino(dest);
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, [sede]);

  const instr = metodo ? instruccionPago(metodo, destino) : null;
  const metodoLabel = metodo ? t(`chat.metodos.${metodo}`) : "";

  async function copiar(
    valor: string | undefined,
    setFlag: (v: boolean) => void,
  ) {
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      setFlag(true);
      setTimeout(() => setFlag(false), 1500);
    } catch {
      /* sin clipboard: se copia a mano */
    }
  }

  async function enviarComprobante() {
    if (!comprobante[0] || !metodo) return;
    setBusy(true);
    setError(null);
    try {
      // Crea el chat de pago la primera vez; si ya existe, reusa el id (el método
      // quedó fijado al crearlo).
      const cid =
        convId ??
        (await createPaymentConversation({
          uid,
          concepto: "pedido",
          ref: { kind: "pedido", id: pedidoId },
          metodo,
          monto: total,
        }));
      setConvId(cid);
      await sendConversationMessage(cid, {
        from: uid,
        tipo: "comprobante",
        texto: t("pago.receiptSent"),
        attachmentUrl: comprobante[0].url,
        attachmentName: comprobante[0].name,
      });
      await marcarComprobanteEnRevision(cid);
      setComprobante([]);
      setSent(true);
      openConversation(cid);
    } catch (e) {
      console.error("[pedido-pago] comprobante:", e);
      setError(t("pago.startError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 py-24">
      <div className={`${glassSurface} relative w-full rounded-3xl p-6`}>
        <GlassSheen />
        <div className="relative">
          <p className="text-amethyst-300 text-xs tracking-[3px] uppercase">
            {t("pedidoPago.eyebrow")}
          </p>
          <h1 className="font-narrow mt-2 text-3xl font-bold text-white uppercase">
            {t("pedidoPago.heading")}
          </h1>
          <p className="text-silver-300 mt-2 text-sm">
            {t("pedidoPago.total")}{" "}
            <span className="font-semibold text-white">{formatCOP(total)}</span>
          </p>

          {sent ? (
            <div className="mt-6 flex flex-col gap-4">
              <Alert tone="success">{t("pedidoPago.validating")}</Alert>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/solicitudes/pedido/${pedidoId}`}
                  className="btn-amethyst flex-1 rounded-full px-6 py-3 text-center text-sm font-semibold tracking-[2px] uppercase"
                >
                  {t("pedidoPago.viewOrder")}
                </Link>
                <Link
                  href="/"
                  className="btn-outline flex-1 rounded-full px-6 py-3 text-center text-sm tracking-[2px] uppercase"
                >
                  {t("compraWizard.goHome")}
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="btn-amethyst w-full rounded-full px-6 py-3 text-center text-sm font-semibold tracking-[2px] uppercase"
              >
                {metodo
                  ? t("pedidoPago.changeMethod", { metodo: metodoLabel })
                  : t("pedidoPago.pay")}
              </button>

              {instr && (
                <div className="border-amethyst-300/30 bg-amethyst-500/5 rounded-xl border p-4">
                  <p className="font-semibold text-white">
                    {t("pago.payWith", {
                      monto: formatCOP(total),
                      metodo: metodoLabel,
                    })}
                  </p>

                  {instr.valor && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-silver-100 font-mono text-sm">
                        {instr.valor}
                      </span>
                      <button
                        type="button"
                        onClick={() => copiar(instr.valor, setCopied)}
                        className={COPY_CHIP}
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

                  {instr.llaveBreB && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-amethyst-200 inline-flex items-center gap-1.5 text-xs font-semibold tracking-[1px] uppercase">
                        <KeyIcon className="size-4" />
                        {t("pago.breB")}
                      </span>
                      <span className="text-silver-100 font-mono text-sm">
                        {instr.llaveBreB}
                      </span>
                      <button
                        type="button"
                        onClick={() => copiar(instr.llaveBreB, setCopiedBreB)}
                        className={COPY_CHIP}
                      >
                        {copiedBreB ? (
                          <CheckIcon className="size-3.5" />
                        ) : (
                          <CopyIcon className="size-3.5" />
                        )}
                        {copiedBreB ? t("pago.copied") : t("pago.copy")}
                      </button>
                    </div>
                  )}

                  {instr.qrUrl && (
                    <PaymentQr url={instr.qrUrl} label={metodoLabel} />
                  )}

                  {instr.nota && (
                    <p className="text-silver-200 mt-2 text-sm">{instr.nota}</p>
                  )}

                  <p className="text-silver-400 mt-3 text-xs">
                    {t("pago.instructions")}
                  </p>
                  <div className="mt-3">
                    <FileUpload
                      value={comprobante}
                      onChange={setComprobante}
                      accept="image/*,application/pdf"
                    />
                  </div>
                  <Button
                    className="mt-3 w-full"
                    onClick={enviarComprobante}
                    loading={busy}
                    disabled={comprobante.length === 0}
                  >
                    {t("pago.uploadReceipt")}
                  </Button>
                  {error && (
                    <Alert tone="error" className="mt-2">
                      {error}
                    </Alert>
                  )}
                </div>
              )}

              {!metodo && (
                <p className="text-silver-400 text-center text-xs">
                  {t("pedidoPago.hint")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {showPicker && (
        <PaymentMethodPicker
          insignia={null}
          onPick={(m) => {
            setMetodo(m);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </main>
  );
}
