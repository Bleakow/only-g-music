"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  subscribeConversation,
  subscribeMessages,
  confirmarPago,
  rechazarPago,
} from "@/features/conversations/lib/conversations-repo";
import type {
  Conversation,
  ConversationMessage,
} from "@only-g/shared-types/conversation";
import { formatCOP } from "@only-g/shared-types/service";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { Alert } from "@/components/ui/Alert";
import { SpinnerIcon } from "@/components/icons";

/** ¿La URL/nombre apunta a una imagen? (para previsualizar el comprobante; los
 *  PDF u otros se muestran como enlace). Storage deja la extensión antes del `?`. */
function esImagen(url?: string, name?: string): boolean {
  const s = `${name ?? ""} ${url ?? ""}`.toLowerCase();
  return /\.(png|jpe?g|gif|webp|avif|heic)(\?|$|&)/.test(s);
}

/**
 * Detalle de un pago pendiente, INLINE (modal centrado en la misma ventana de
 * /admin/pagos) — reemplaza el viejo flujo de abrir la burbuja de chat, donde el
 * comprobante y los botones quedaban recortados. Muestra concepto + monto +
 * método + comprobante, y deja al admin confirmar (Cloud Function) o rechazar.
 */
export function AdminPagoDetail({
  id,
  onClose,
  onResolved,
}: {
  id: string | null;
  onClose: () => void;
  /** Tras confirmar/rechazar (el pago sale de la lista de pendientes). */
  onResolved: () => void;
}) {
  const t = useTranslations();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [busy, setBusy] = useState<null | "confirm" | "reject">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setBusy(null);
    if (!id) {
      setConversation(null);
      setMessages([]);
      return;
    }
    const unsubC = subscribeConversation(id, setConversation);
    const unsubM = subscribeMessages(id, setMessages);
    return () => {
      unsubC();
      unsubM();
    };
  }, [id]);

  const pago = conversation?.pago;
  const comprobantes = messages.filter(
    (m) => m.tipo === "comprobante" && m.attachmentUrl,
  );

  async function confirmar() {
    if (!id) return;
    setBusy("confirm");
    setError(null);
    try {
      await confirmarPago(id);
      onResolved();
    } catch (e) {
      console.error("[admin-pago] confirmar:", e);
      setError(t("pago.confirmError"));
      setBusy(null);
    }
  }

  async function rechazar() {
    if (!id) return;
    setBusy("reject");
    setError(null);
    try {
      await rechazarPago(id);
      onResolved();
    } catch (e) {
      console.error("[admin-pago] rechazar:", e);
      setError(t("pago.confirmError"));
      setBusy(null);
    }
  }

  return (
    <GlassModal
      open={!!id}
      onClose={() => !busy && onClose()}
      title={t("adminPagos.detailTitle")}
    >
      {!conversation ? (
        <div className="flex justify-center py-10">
          <SpinnerIcon className="text-silver-400 size-6 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-lg font-semibold text-white">
              {pago?.concepto ? t(`adminPagos.concepto.${pago.concepto}`) : ""}
            </p>
            <p className="text-silver-300 text-sm">
              {formatCOP(pago?.monto ?? 0)}
              {pago?.metodo ? ` · ${t(`chat.metodos.${pago.metodo}`)}` : ""}
            </p>
          </div>

          {/* Comprobante(s) subidos por el cliente */}
          <div>
            <p className="text-silver-400 mb-2 text-xs tracking-[2px] uppercase">
              {t("adminPagos.receipt")}
            </p>
            {comprobantes.length === 0 ? (
              <p className="text-silver-400 text-sm">
                {t("adminPagos.noReceipt")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {comprobantes.map((m) =>
                  esImagen(m.attachmentUrl, m.attachmentName) ? (
                    <a
                      key={m.id}
                      href={m.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block h-80 w-full overflow-hidden rounded-xl border border-white/15 bg-black/40"
                    >
                      <Image
                        src={m.attachmentUrl!}
                        alt={m.attachmentName ?? t("adminPagos.receipt")}
                        fill
                        sizes="(max-width: 640px) 90vw, 420px"
                        className="object-contain"
                      />
                    </a>
                  ) : (
                    <a
                      key={m.id}
                      href={m.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amethyst-200 block rounded-xl border border-white/15 px-4 py-3 text-sm underline underline-offset-2 hover:text-white"
                    >
                      {m.attachmentName ?? t("chat.viewFile")}
                    </a>
                  ),
                )}
              </div>
            )}
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
            <GlassButton
              onClick={rechazar}
              disabled={!!busy}
              className="!text-red-200"
            >
              {busy === "reject" ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : null}
              {t("pago.rejectButton")}
            </GlassButton>
            <GlassButton
              onClick={confirmar}
              disabled={!!busy || comprobantes.length === 0}
              className="!text-amethyst-200"
            >
              {busy === "confirm" ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : null}
              {t("pago.confirmButton", { monto: formatCOP(pago?.monto ?? 0) })}
            </GlassButton>
          </div>
        </div>
      )}
    </GlassModal>
  );
}
