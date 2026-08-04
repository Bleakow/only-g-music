"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import type {
  Conversation,
  PagoConcepto,
} from "@only-g/shared-types/conversation";
import { createWompiPaymentConversation } from "@/features/conversations/lib/conversations-repo";
import { WompiCheckout } from "./WompiCheckout";

/**
 * Botón de COMPRA autocontenido: abre el hilo del pago y el checkout de la
 * pasarela, en la misma pantalla.
 *
 * Existe para que los seis sitios que venden algo (membresía del perfil, G Notes,
 * beats, colectivos, pases…) no repitan el cableado. Antes cada uno abría su
 * selector de método, creaba el chat y confiaba en que la burbuja apareciera; ese
 * "confiaba" ya costó un bug de "pulso y no pasa nada".
 */
export function PagarButton({
  uid,
  concepto,
  pagoRef,
  monto,
  label,
  conceptoLabel,
  className,
  onDone,
}: {
  uid: string;
  concepto: PagoConcepto;
  /** Enlace a la entidad de contexto. No se llama `ref`: React intercepta esa prop. */
  pagoRef: NonNullable<Conversation["ref"]>;
  monto: number;
  label: string;
  /** Nombre legible de lo que se compra (resumen del checkout). */
  conceptoLabel?: string;
  className?: string;
  /** Se llama al cerrar el checkout (para refrescar lo que haga falta). */
  onDone?: () => void;
}) {
  const t = useTranslations();
  const [convId, setConvId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pagar() {
    if (busy) return;
    // El hilo se reusa entre reintentos: no se crea uno por cada clic.
    if (convId) {
      setOpen(true);
      return;
    }
    setBusy(true);
    try {
      const id = await createWompiPaymentConversation({
        uid,
        concepto,
        ref: pagoRef,
        monto,
      });
      setConvId(id);
      setOpen(true);
    } catch (e) {
      console.error("[pagar]", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <GlassButton onClick={pagar} disabled={busy} className={className}>
        {label}
      </GlassButton>
      {convId && (
        <WompiCheckout
          open={open}
          onClose={() => {
            setOpen(false);
            onDone?.();
          }}
          conversationId={convId}
          monto={monto}
          concepto={conceptoLabel ?? t("checkout.conceptoGenerico")}
        />
      )}
    </>
  );
}
