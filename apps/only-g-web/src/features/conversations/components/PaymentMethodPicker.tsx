"use client";

import { useTranslations } from "next-intl";
import { GlassModal } from "@/components/ui/GlassModal";
import type { Insignia } from "@only-g/shared-types/artist-profile";
import type { MetodoPago } from "@only-g/shared-types/payment-method";
import { metodosConEstado } from "@only-g/shared-types/payment-method";

/**
 * Selector de método de pago (modal). La disponibilidad sale del dominio
 * (`metodosConEstado`): la tarjeta queda "próximamente" y el efectivo solo se
 * habilita con insignia diamante; el resto queda libre. Al elegir un método
 * disponible, `onPick` abre el chat de pago correspondiente.
 *
 * Se monta condicionalmente desde el padre (`{showPicker && <PaymentMethodPicker
 * .../>}`), no recibe `open` propio: por eso GlassModal va siempre `open`.
 */
export function PaymentMethodPicker({
  onPick,
  onClose,
  insignia,
}: {
  onPick: (metodo: MetodoPago) => void;
  onClose: () => void;
  insignia: Insignia | null;
}) {
  const t = useTranslations();
  const metodos = metodosConEstado(insignia);

  return (
    <GlassModal
      open
      onClose={onClose}
      title={t("pago.chooseMethod")}
      className="max-w-sm"
    >
      <ul className="flex flex-col gap-2">
        {metodos.map(({ metodo, disponible, bloqueo }) => (
          <li key={metodo}>
            <button
              type="button"
              disabled={!disponible}
              onClick={() => onPick(metodo)}
              className="flex w-full flex-col gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-amethyst-300/60 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03]"
            >
              <span className="font-semibold text-white">
                {t(`chat.metodos.${metodo}`)}
              </span>
              {bloqueo && (
                <span className="text-xs text-silver-400">
                  {bloqueo.tipo === "proximamente"
                    ? t("pago.comingSoon")
                    : t("pago.cashOnlyHigherTier")}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </GlassModal>
  );
}
