"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  subscribeConversation,
  confirmarPago,
  rechazarPago,
} from "@/features/conversations/lib/conversations-repo";
import type { Conversation } from "@only-g/shared-types/conversation";
import { formatCOP } from "@only-g/shared-types/service";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { Alert } from "@/components/ui/Alert";
import { SpinnerIcon } from "@/components/icons";

/**
 * Detalle de un pago pendiente, INLINE (modal centrado en la misma ventana de
 * /admin/pagos).
 *
 * Lo único que llega aquí es dinero FÍSICO: pagos anunciados en sede. Lo que
 * cobra la pasarela no pasa por manos de nadie —lo confirma su webhook— así que
 * este panel ya no revisa comprobantes: dice cuánto hay que recibir y deja
 * marcarlo cuando el equipo lo tiene.
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
  const [busy, setBusy] = useState<null | "confirm" | "reject">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setBusy(null);
    if (!id) {
      setConversation(null);
      return;
    }
    return subscribeConversation(id, setConversation);
  }, [id]);

  const pago = conversation?.pago;

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
            </p>
          </div>

          <Alert tone="info">{t("adminPagos.enSedeHint")}</Alert>

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
              disabled={!!busy}
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
