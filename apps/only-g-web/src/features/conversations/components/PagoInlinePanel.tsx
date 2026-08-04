"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/Alert";
import { formatCOP } from "@only-g/shared-types/service";
import { puedePagarEnSede } from "@only-g/shared-types/payment-method";
import type {
  PagoConcepto,
  Conversation,
} from "@only-g/shared-types/conversation";
import type { Insignia } from "@only-g/shared-types/artist-profile";
import {
  createCashPaymentConversation,
  createWompiPaymentConversation,
} from "../lib/conversations-repo";
import { WompiCheckout } from "@/features/payments/components/WompiCheckout";

/**
 * Panel de pago INLINE reutilizable (reserva, pedido, perfil…): cobra por
 * PASARELA en la misma pantalla, sin abrir la burbuja de chat.
 *
 * Aquí vivía el pago manual —elegir método, QR, llave Bre-B, subir comprobante y
 * esperar a que alguien lo mirara— y ya no existe: cobrar por pasarela y mantener
 * además un circuito que un humano revisa a ojo son dos verdades sobre el mismo
 * dinero, y la de a mano siempre acaba desactualizada.
 *
 * Queda UNA excepción: pagar EN SEDE, que la pasarela no cubre porque es dinero
 * físico. Solo se ofrece a quien tiene la insignia máxima (perk de confianza) y
 * no cobra nada por sí mismo: anuncia el pago y el equipo lo confirma al
 * recibirlo.
 */
export function PagoInlinePanel({
  uid,
  concepto,
  pagoRef,
  monto,
  insignia = null,
  conceptoLabel,
  onSent,
}: {
  uid: string;
  concepto: PagoConcepto;
  /** Enlace a la entidad de contexto (`{ kind, id }`). No se llama `ref` a
   *  propósito: React intercepta esa prop. */
  pagoRef: NonNullable<Conversation["ref"]>;
  monto: number;
  insignia?: Insignia | null;
  /** Nombre legible de lo que se compra, para el resumen del checkout. */
  conceptoLabel?: string;
  /** Se llama con el id del hilo de pago cuando ya hay algo que seguir. */
  onSent?: (convId: string) => void;
}) {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [wompiConvId, setWompiConvId] = useState<string | null>(null);
  const [wompiBusy, setWompiBusy] = useState(false);
  const [sedeBusy, setSedeBusy] = useState(false);
  const [sedeAvisada, setSedeAvisada] = useState(false);

  /**
   * Abre el checkout de Wompi. Antes crea el hilo del pago porque el servidor
   * saca de ahí QUÉ se compra (y recalcula el importe). El hilo se reusa entre
   * reintentos: no se crea uno por cada clic.
   */
  async function abrirCheckout() {
    setError(null);
    if (wompiConvId) {
      setCheckoutOpen(true);
      return;
    }
    setWompiBusy(true);
    try {
      const cid = await createWompiPaymentConversation({
        uid,
        concepto,
        ref: pagoRef,
        monto,
      });
      setWompiConvId(cid);
      setCheckoutOpen(true);
    } catch (e) {
      console.error("[pago] abrir checkout:", e);
      setError(t("checkout.errors.crear"));
    } finally {
      setWompiBusy(false);
    }
  }

  /** Anuncia un pago EN SEDE: queda a la espera de que el equipo lo confirme. */
  async function pagarEnSede() {
    setError(null);
    setSedeBusy(true);
    try {
      const cid = await createCashPaymentConversation({
        uid,
        concepto,
        ref: pagoRef,
        monto,
      });
      setSedeAvisada(true);
      onSent?.(cid);
    } catch (e) {
      console.error("[pago] en sede:", e);
      setError(t("pago.startError"));
    } finally {
      setSedeBusy(false);
    }
  }

  if (sedeAvisada) {
    return (
      <Alert tone="info">{t("pago.enSedeAvisado")}</Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={abrirCheckout}
        disabled={wompiBusy}
        className="btn-amethyst w-full rounded-full px-6 py-3 text-center text-sm font-semibold tracking-[2px] uppercase disabled:opacity-60"
      >
        {wompiBusy
          ? t("checkout.procesando")
          : t("checkout.pagar", { monto: formatCOP(monto) })}
      </button>

      {puedePagarEnSede(insignia) && (
        <div>
          <button
            type="button"
            onClick={pagarEnSede}
            disabled={sedeBusy}
            className="text-silver-300 min-h-11 w-full text-xs font-semibold tracking-[1px] uppercase transition hover:text-white disabled:opacity-60"
          >
            {sedeBusy ? t("pago.enSedeEnviando") : t("pago.enSede")}
          </button>
          <p className="text-silver-500 text-center text-[0.7rem]">
            {t("pago.enSedeHint")}
          </p>
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {wompiConvId && (
        <WompiCheckout
          open={checkoutOpen}
          onClose={() => {
            setCheckoutOpen(false);
            // El padre decide qué enseñar tras pagar. Si el pago no se completó,
            // el hilo sigue abierto y el botón lo reabre sin crear otro.
            onSent?.(wompiConvId);
          }}
          conversationId={wompiConvId}
          monto={monto}
          concepto={conceptoLabel ?? t("checkout.conceptoGenerico")}
        />
      )}
    </div>
  );
}
