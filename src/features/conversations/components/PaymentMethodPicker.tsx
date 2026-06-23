"use client";

import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import type { PagoMetodo } from "@/domain/conversation";
import { METODOS_PAGO } from "../data/payment-methods";

/**
 * Selector de método de pago (modal). El efectivo (`soloTierAlto`) solo se
 * habilita si `tierAlto` (hoy = insignia diamante); si no, queda bloqueado con
 * su aviso. Al elegir un método, `onPick` abre el chat de pago correspondiente.
 */
export function PaymentMethodPicker({
  onPick,
  onClose,
  tierAlto,
}: {
  onPick: (metodo: PagoMetodo) => void;
  onClose: () => void;
  tierAlto: boolean;
}) {
  const t = useTranslations();

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
          {METODOS_PAGO.map((m) => {
            const locked = !!m.soloTierAlto && !tierAlto;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onPick(m.id)}
                  className="flex w-full flex-col gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-amethyst-300/60 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03]"
                >
                  <span className="font-semibold text-white">
                    {t(`chat.metodos.${m.id}`)}
                  </span>
                  {locked && (
                    <span className="text-xs text-silver-400">
                      {t("pago.cashOnlyHigherTier")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
