"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { getPedidoById } from "../lib/pedidos-repo";
import { createPaymentConversation } from "@/features/conversations/lib/conversations-repo";
import { openConversation } from "@/features/conversations/lib/open-conversation";
import { PaymentMethodPicker } from "@/features/conversations/components/PaymentMethodPicker";
import { getProfileBySlug } from "@/features/artists/lib/artist-profile-repo";
import { Button } from "@/components/ui/Button";
import { sedes } from "@/features/sedes/data/sedes";
import { formatCOP } from "@only-g/shared-types/service";
import {
  insigniaDePuntos,
  type Insignia,
} from "@only-g/shared-types/artist-profile";
import type { MetodoPago } from "@only-g/shared-types/payment-method";
import type { Pedido } from "@only-g/shared-types/pedido";
import { badgeClass } from "@/features/solicitudes/lib/estados";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Detalle + pago de un PEDIDO (compra directa). Calca el flujo de pago de
 * `SolicitudDetail` (reserva): botón "Pagar" → `PaymentMethodPicker` → abre un
 * chat de pago propio (`concepto: "pedido"`). El estado se refleja server-side
 * (Cloud Function confirma todas las reservas del pedido a la vez), por eso no
 * hay acciones de cliente más allá de iniciar el pago. Sin hilo de soporte: el
 * pedido no tiene uno propio (a diferencia de cotización/reserva).
 */
export function PedidoDetail({ id }: { id: string }) {
  const t = useTranslations();
  const { account } = useAuth();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [insignia, setInsignia] = useState<Insignia | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPedidoById(id)
      .then((p) => {
        if (!active) return;
        setPedido(p);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Insignia del pagador (deriva el gate de efectivo del picker). Un no-artista
  // no tiene perfil → insignia null → efectivo bloqueado.
  useEffect(() => {
    const slug = account?.artistSlug;
    if (!slug) {
      setInsignia(null);
      return;
    }
    let active = true;
    getProfileBySlug(slug)
      .then((p) => {
        if (active) setInsignia(p ? insigniaDePuntos(p.puntos ?? 0) : null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [account?.artistSlug]);

  // Arranca el pago del pedido: abre un chat de pago propio (tipo `pago`) y la
  // burbuja. El comprobante y la confirmación viven en ese hilo (PagoPanel).
  async function iniciarPagoPedido(metodo: MetodoPago) {
    if (!pedido) return;
    setShowPicker(false);
    try {
      const cid = await createPaymentConversation({
        uid: pedido.uid,
        concepto: "pedido",
        ref: { kind: "pedido", id: pedido.id },
        metodo,
        monto: pedido.total,
      });
      openConversation(cid);
    } catch (e) {
      console.error("[pedido] iniciarPago:", e);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-dvh max-w-2xl px-6 pt-28 pb-24 sm:px-12">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-3 h-4 w-1/3" />
          <Skeleton className="mt-3 h-6 w-24" />
        </section>
      </main>
    );
  }

  if (!pedido) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-narrow text-3xl font-bold uppercase">
          {t("solicitudDetail.notFound")}
        </h1>
        <Link
          href="/solicitudes"
          className="btn-outline mt-6 rounded-full px-6 py-3 text-sm tracking-[2px] uppercase"
        >
          {t("solicitudDetail.backToRequests")}
        </Link>
      </main>
    );
  }

  const label = t(`status.${pedido.estado}`);
  const sede = sedes.find((s) => s.id === pedido.sede);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pt-28 pb-24 sm:px-12">
      <Link
        href="/solicitudes"
        className="text-silver-300 text-sm underline-offset-4 hover:text-white hover:underline"
      >
        ← {t("userMenu.myRequests")}
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="font-narrow text-4xl font-bold uppercase sm:text-5xl">
          {t("pedidoDetail.title")}
        </h1>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs ${badgeClass(pedido.estado)}`}
        >
          {label}
        </span>
      </div>

      {/* Resumen */}
      <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
        <ul className="flex flex-col gap-1">
          {pedido.lineas.map((l, idx) => (
            <li
              key={l.reservaId ?? idx}
              className="text-silver-100 flex justify-between"
            >
              <span>
                {l.serviceName}{" "}
                <span className="text-silver-400">× {l.cantidad}</span>
              </span>
              <span>{formatCOP(l.subtotal)}</span>
            </li>
          ))}
        </ul>
        <p className="text-silver-300 mt-2 border-t border-white/10 pt-2">
          {t("solicitudDetail.venue", { name: sede?.nombre ?? pedido.sede })}
        </p>
        <p className="mt-1 font-semibold text-white">
          {t("pedidoDetail.total", { amount: formatCOP(pedido.total) })}
        </p>
      </section>

      {/* Acción: pago del pedido → abre un chat de pago propio */}
      {pedido.estado === "pendiente_pago" && (
        <section className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
          <h2 className="font-narrow text-xl font-bold text-white uppercase">
            {t("solicitudDetail.payment")}
          </h2>
          <p className="text-silver-300 mt-2 text-sm">
            {t("solicitudDetail.paymentStartHint")}
          </p>
          <Button
            className="btn-amethyst mt-3"
            onClick={() => setShowPicker(true)}
          >
            {t("solicitudDetail.pay")}
          </Button>
        </section>
      )}

      {showPicker && (
        <PaymentMethodPicker
          onPick={iniciarPagoPedido}
          onClose={() => setShowPicker(false)}
          insignia={insignia}
        />
      )}

      {pedido.estado === "pago_en_revision" && (
        <p className="mt-6 rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
          {t("solicitudDetail.receiptUnderReview")}
        </p>
      )}

      {pedido.estado === "confirmado" && (
        <p className="mt-6 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {t("pedidoDetail.confirmedNote")}
        </p>
      )}

      {pedido.estado === "cancelado" && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {t("pedidoDetail.cancelledNote")}
        </p>
      )}
    </main>
  );
}
