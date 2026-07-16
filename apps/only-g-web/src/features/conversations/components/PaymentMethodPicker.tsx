"use client";

import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import type { Insignia } from "@only-g/shared-types/artist-profile";
import type { MetodoPago } from "@only-g/shared-types/payment-method";
import { metodosConEstado } from "@only-g/shared-types/payment-method";

/**
 * Selector de método de pago (modal). La disponibilidad sale del dominio
 * (`metodosConEstado`): la tarjeta queda "próximamente" y el efectivo solo se
 * habilita con insignia diamante; el resto queda libre. Al elegir un método
 * disponible, `onPick` abre el chat de pago correspondiente.
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("chat.close")}
          className="absolute right-4 top-4 text-white/60 transition hover:text-white"
        >
          <CloseIcon className="size-5" />
        </button>

        <h3 className="font-narrow text-2xl font-bold uppercase text-white">
          {t("pago.chooseMethod")}
        </h3>

        <ul className="mt-5 flex flex-col gap-2">
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
      </div>
    </div>
  );
}
