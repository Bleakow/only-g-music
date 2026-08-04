"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatCOP } from "@only-g/shared-types/service";
import type { Conversation } from "@only-g/shared-types/conversation";
import { confirmarPago, rechazarPago } from "../lib/conversations-repo";

/**
 * Panel del chat de PAGO. Con el cobro por pasarela ya no hay nada que hacer
 * aquí desde el lado del cliente —ni elegir método, ni subir comprobante, ni
 * esperar a que alguien mire una captura—: solo queda informar del estado.
 *
 * La única acción viva es la del equipo sobre un pago EN SEDE (`en_revision`):
 * confirmarlo cuando el dinero llega, o rechazarlo si no llegó. La confirmación
 * es server-authoritative (`confirmPayment`): concede lo comprado y cierra el hilo.
 */
export function PagoPanel({
  conversation,
  isAdmin,
}: {
  conversation: Conversation;
  isAdmin: boolean;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pago = conversation.pago;
  if (!pago) return null;

  async function accion(fn: (id: string) => Promise<void>, errorKey: string) {
    setBusy(true);
    setError(null);
    try {
      await fn(conversation.id);
    } catch (e) {
      console.error("[pago-panel]", e);
      setError(t(errorKey));
    } finally {
      setBusy(false);
    }
  }

  if (pago.estado === "pendiente_pasarela") {
    return (
      <div className="border-t border-white/10 p-4">
        <Alert tone="info">{t("pago.esperandoPasarela")}</Alert>
      </div>
    );
  }

  if (pago.estado === "en_revision") {
    return (
      <div className="flex flex-col gap-3 border-t border-white/10 p-4">
        <Alert tone="info">
          {isAdmin
            ? t("pago.enSedePorConfirmar", { monto: formatCOP(pago.monto) })
            : t("pago.enSedeAvisado")}
        </Alert>
        {isAdmin && (
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => accion(confirmarPago, "pago.confirmError")}
              loading={busy}
            >
              {t("pago.confirmar")}
            </Button>
            <Button
              variant="danger"
              onClick={() => accion(rechazarPago, "pago.rejectError")}
              disabled={busy}
            >
              {t("pago.rechazar")}
            </Button>
          </div>
        )}
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    );
  }

  if (pago.estado === "rechazado") {
    return (
      <div className="border-t border-white/10 p-4">
        <Alert tone="error">{t("pago.rechazado")}</Alert>
      </div>
    );
  }

  // `confirmado`: el mensaje `pago_confirmado` ya lo cuenta dentro del hilo.
  return null;
}
