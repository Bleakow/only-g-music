"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/components/ui/Alert";
import { glassSurface, GlassSheen } from "@/components/ui/glass";
import { formatCOP } from "@only-g/shared-types/service";
import type { SedeId } from "@only-g/shared-types/sede";
import { PagoInlinePanel } from "@/features/conversations/components/PagoInlinePanel";
import { openConversation } from "@/features/conversations/lib/open-conversation";

/**
 * Cierre de la compra: panel de pago INLINE. "Ir a pagar" → elige método → QR +
 * llave Bre-B + subir comprobante, en la misma pantalla (`PagoInlinePanel`). Al
 * enviar el comprobante muestra el aviso de validación y abre la burbuja del chat
 * de pago (para seguir la confirmación del admin).
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
  const [sent, setSent] = useState(false);

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
            <div className="mt-6">
              <PagoInlinePanel
                uid={uid}
                concepto="pedido"
                pagoRef={{ kind: "pedido", id: pedidoId }}
                monto={total}
                sede={sede}
                onSent={(cid) => {
                  setSent(true);
                  openConversation(cid);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
