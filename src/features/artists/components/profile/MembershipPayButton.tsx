"use client";

import { useState } from "react";
import { GlassButton } from "@/components/ui/GlassButton";
import { PaymentMethodPicker } from "@/features/conversations/components/PaymentMethodPicker";
import { createPaymentConversation } from "@/features/conversations/lib/conversations-repo";
import { openConversation } from "@/features/conversations/lib/open-conversation";
import { PRECIO_PERFIL } from "@/domain/profile-order";
import { insigniaDePuntos } from "@/domain/artist-profile";
import type { MetodoPago } from "@/domain/payment-method";

/**
 * Botón "Activar membresía" autocontenido: abre el selector de método de pago y,
 * al elegir, crea el chat de pago premium y abre la burbuja en él (el admin
 * confirma el pago → premium activado por Cloud Function). Reutilizable allá donde
 * haga falta ofrecer la activación (editor, vista pública, gate de compartir) sin
 * duplicar el cableado del flujo de pago.
 */
export function MembershipPayButton({
  uid,
  slug,
  puntos,
  label,
  className,
}: {
  uid: string;
  slug: string;
  puntos: number;
  label: string;
  className?: string;
}) {
  const [showPicker, setShowPicker] = useState(false);

  async function iniciarPago(metodo: MetodoPago) {
    setShowPicker(false);
    try {
      const id = await createPaymentConversation({
        uid,
        concepto: "premium",
        ref: { kind: "premium", id: slug },
        metodo,
        monto: PRECIO_PERFIL,
      });
      openConversation(id);
    } catch (e) {
      console.error("[membership] iniciarPago:", e);
    }
  }

  return (
    <>
      <GlassButton onClick={() => setShowPicker(true)} className={className}>
        {label}
      </GlassButton>
      {showPicker && (
        <PaymentMethodPicker
          onPick={iniciarPago}
          onClose={() => setShowPicker(false)}
          insignia={insigniaDePuntos(puntos)}
        />
      )}
    </>
  );
}
