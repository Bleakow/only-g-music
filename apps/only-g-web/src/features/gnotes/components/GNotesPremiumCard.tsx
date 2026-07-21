"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import { PaymentMethodPicker } from "@/features/conversations/components/PaymentMethodPicker";
import { createPaymentConversation } from "@/features/conversations/lib/conversations-repo";
import { openConversation } from "@/features/conversations/lib/open-conversation";
import { usePrecios } from "@/features/pricing/components/PreciosProvider";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { formatCOP } from "@only-g/shared-types/service";
import {
  gnotesActiva,
  type GNotesMembership,
} from "@only-g/shared-types/gnotes-membership";
import type { MetodoPago } from "@only-g/shared-types/payment-method";

/**
 * Tarjeta "G Notes premium" en la cuenta: muestra el estado de la membresía (IA
 * sin límite) y, si no está activa o está por vencer, ofrece suscribirse. Reusa
 * el MISMO flujo de pago que el resto de compras: elige método → crea el chat de
 * pago (concepto "gnotes") → el admin confirma → la Cloud Function activa la
 * membresía +1 mes. Es también el destino del empujón que G Notes muestra al
 * topar el cupo diario gratis.
 */
export function GNotesPremiumCard() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, account } = useAuth();
  const { precioGNotes } = usePrecios();
  const [showPicker, setShowPicker] = useState(false);

  const membership = account?.gnotesPremium as GNotesMembership | undefined;
  const activa = gnotesActiva(membership, Date.now());
  const vence =
    membership?.expiresAt != null
      ? new Date(membership.expiresAt).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  async function iniciarPago(metodo: MetodoPago) {
    setShowPicker(false);
    if (!user) return;
    try {
      const id = await createPaymentConversation({
        uid: user.uid,
        concepto: "gnotes",
        ref: { kind: "gnotes", id: user.uid },
        metodo,
        monto: precioGNotes,
      });
      openConversation(id);
    } catch (e) {
      console.error("[gnotes] iniciarPago:", e);
    }
  }

  return (
    <section id="gnotes-premium" className="mt-12 scroll-mt-28">
      <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase">
        {t("gnotesPremium.title")}
      </h2>

      <div className="border-amethyst-300/30 from-amethyst-500/10 mt-4 rounded-2xl border bg-linear-to-br to-transparent p-5">
        {activa ? (
          <>
            <p className="text-amethyst-100 font-semibold">
              {t("gnotesPremium.activa")}
            </p>
            {vence && (
              <p className="text-silver-300 mt-1 text-sm">
                {t("gnotesPremium.vence", { fecha: vence })}
              </p>
            )}
            <div className="mt-4">
              <GlassButton
                onClick={() => setShowPicker(true)}
                className="!text-amethyst-200"
              >
                {t("gnotesPremium.renovar")}
              </GlassButton>
            </div>
          </>
        ) : (
          <>
            <p className="text-silver-200">{t("gnotesPremium.descripcion")}</p>
            <p className="mt-3 text-2xl font-bold text-white">
              {formatCOP(precioGNotes)}
              <span className="text-silver-400 ml-1 text-sm font-normal">
                {t("gnotesPremium.porMes")}
              </span>
            </p>
            <div className="mt-4">
              <GlassButton
                onClick={() => setShowPicker(true)}
                className="!text-amethyst-200"
              >
                {t("gnotesPremium.suscribirse")}
              </GlassButton>
            </div>
          </>
        )}
      </div>

      {showPicker && (
        <PaymentMethodPicker
          onPick={iniciarPago}
          onClose={() => setShowPicker(false)}
          insignia={null}
        />
      )}
    </section>
  );
}
