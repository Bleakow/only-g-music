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
  PASES,
  PASE_TIPOS,
  paseEstado,
  type PaseTipo,
} from "@only-g/shared-types/pase";
import type { MetodoPago } from "@only-g/shared-types/payment-method";

/** Mapea cada tier a su clave de precio en la config comercial. */
const PRECIO_KEY: Record<
  PaseTipo,
  "precioLitePass" | "precioGoldenPass" | "precioPremiumPass"
> = {
  lite: "precioLitePass",
  golden: "precioGoldenPass",
  premium: "precioPremiumPass",
};

/**
 * Panel de SUSCRIPCIONES: las 3 cards de pases (Lite/Golden/Premium) con lo que
 * incluye cada uno y su precio. "Suscribirse" reusa el MISMO flujo de compra que
 * el resto (elige método → chat de pago concepto "pase" → el admin confirma → la
 * Cloud Function concede todos los beneficios). Si el usuario ya tiene un pase
 * activo, se marca cuál es y se listan sus vales pendientes.
 */
export function SubscriptionsPanel() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, account } = useAuth();
  const precios = usePrecios();
  const [picker, setPicker] = useState<PaseTipo | null>(null);

  const pase = account?.pase;
  const activo = pase ? paseEstado(pase, Date.now()) === "activo" : false;
  const vence =
    pase?.expiresAt != null
      ? new Date(pase.expiresAt).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  async function comprar(tipo: PaseTipo, metodo: MetodoPago) {
    setPicker(null);
    if (!user) return;
    try {
      const id = await createPaymentConversation({
        uid: user.uid,
        concepto: "pase",
        ref: { kind: "pase", id: tipo },
        metodo,
        monto: precios[PRECIO_KEY[tipo]],
      });
      openConversation(id);
    } catch (e) {
      console.error("[pases] comprar:", e);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 pt-28 pb-24 sm:px-10">
      <p className="text-amethyst-300 text-xs font-semibold tracking-[3px] uppercase">
        {t("pases.eyebrow")}
      </p>
      <h1 className="font-narrow mt-2 text-5xl font-bold uppercase sm:text-6xl">
        {t("pases.title")}
      </h1>
      <p className="text-silver-400 mt-3 max-w-xl">{t("pases.intro")}</p>

      {activo && pase && (
        <div className="border-amethyst-300/30 bg-amethyst-500/10 mt-8 rounded-2xl border p-4">
          <p className="text-amethyst-100 font-semibold">
            {t("pases.tuPase", { pase: t(`pases.${pase.tipo}.nombre`) })}
            {vence ? ` · ${t("pases.activoHasta", { fecha: vence })}` : ""}
          </p>
          {(pase.produccion || pase.video) && (
            <ul className="text-silver-300 mt-2 space-y-1 text-sm">
              {pase.produccion && (
                <li>
                  {t(
                    pase.produccion.alcance === "grupo"
                      ? "pases.incluye.produccionGrupo"
                      : "pases.incluye.produccionArtista",
                  )}{" "}
                  ·{" "}
                  <span
                    className={
                      pase.produccion.usado
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }
                  >
                    {t(
                      pase.produccion.usado
                        ? "pases.valeEntregado"
                        : "pases.valePendiente",
                    )}
                  </span>
                </li>
              )}
              {pase.video && (
                <li>
                  {t("pases.incluye.video")} ·{" "}
                  <span
                    className={
                      pase.video.usado ? "text-emerald-300" : "text-amber-300"
                    }
                  >
                    {t(
                      pase.video.usado
                        ? "pases.valeEntregado"
                        : "pases.valePendiente",
                    )}
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PASE_TIPOS.map((tipo) => {
          const spec = PASES[tipo];
          const precio = precios[PRECIO_KEY[tipo]];
          const esActual = activo && pase?.tipo === tipo;
          const destacado = tipo === "golden";
          return (
            <article
              key={tipo}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                destacado
                  ? "border-amethyst-300/50 bg-amethyst-500/10"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {destacado && (
                <span className="bg-amethyst-500 absolute -top-3 left-6 rounded-full px-3 py-0.5 text-[0.7rem] font-bold text-white uppercase">
                  {t("pases.popular")}
                </span>
              )}
              <h3 className="font-narrow text-2xl font-bold text-white uppercase">
                {t(`pases.${tipo}.nombre`)}
              </h3>
              <p className="mt-3 text-3xl font-bold text-white">
                {formatCOP(precio)}
                <span className="text-silver-400 ml-1 text-sm font-normal">
                  {t("pases.porMes")}
                </span>
              </p>
              <ul className="text-silver-200 mt-5 flex-1 space-y-2 text-sm">
                <li>✓ {t("pases.incluye.gnotes")}</li>
                <li>✓ {t("pases.incluye.perfil")}</li>
                {spec.produccion && (
                  <li>
                    ✓{" "}
                    {t(
                      spec.produccion === "grupo"
                        ? "pases.incluye.produccionGrupo"
                        : "pases.incluye.produccionArtista",
                    )}
                  </li>
                )}
                {spec.video && <li>✓ {t("pases.incluye.video")}</li>}
              </ul>
              <div className="mt-6">
                <GlassButton
                  onClick={() => setPicker(tipo)}
                  disabled={esActual || !user}
                  className={destacado ? "!text-amethyst-100 w-full" : "w-full"}
                >
                  {esActual ? t("pases.actual") : t("pases.suscribirse")}
                </GlassButton>
              </div>
            </article>
          );
        })}
      </div>

      {picker && (
        <PaymentMethodPicker
          onPick={(m) => comprar(picker, m)}
          onClose={() => setPicker(null)}
          insignia={null}
        />
      )}
    </main>
  );
}
