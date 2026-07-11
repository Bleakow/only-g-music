"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import {
  getQuoteById,
  updateQuoteStatus,
} from "@/features/quotes/lib/quotes-repo";
import { getReservaById } from "@/features/booking/lib/booking-repo";
import {
  ensureSupportConversation,
  createPaymentConversation,
} from "@/features/conversations/lib/conversations-repo";
import { openConversation } from "@/features/conversations/lib/open-conversation";
import { PaymentMethodPicker } from "@/features/conversations/components/PaymentMethodPicker";
import { ConversationView } from "@/features/conversations/components/ConversationView";
import { getProfileBySlug } from "@/features/artists/lib/artist-profile-repo";
import { Button } from "@/components/ui/Button";
import { sedes } from "@/features/sedes/data/sedes";
import { formatCOP } from "@/domain/service";
import { insigniaDePuntos, type Insignia } from "@/domain/artist-profile";
import type { MetodoPago } from "@/domain/payment-method";
import type { QuoteRequest } from "@/domain/quote";
import type { Reserva } from "@/domain/booking";
import { badgeClass } from "../lib/estados";
import { Skeleton } from "@/components/ui/Skeleton";

type Tipo = "cotizacion" | "reserva";

export function SolicitudDetail({ tipo, id }: { tipo: Tipo; id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const { account } = useAuth();
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [insignia, setInsignia] = useState<Insignia | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const parent = tipo === "cotizacion" ? "quotes" : "bookings";
  const ownerUid = quote?.uid ?? reserva?.uid ?? null;

  // Asegura el chat de soporte de esta solicitud (cliente ↔ estudio).
  useEffect(() => {
    if (!ownerUid) return;
    let active = true;
    ensureSupportConversation(parent, id, ownerUid)
      .then((cid) => {
        if (active) setConvId(cid);
      })
      .catch((e) => console.error("[support] ensure:", e));
    return () => {
      active = false;
    };
  }, [parent, id, ownerUid]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = tipo === "cotizacion" ? getQuoteById(id) : getReservaById(id);
    load
      .then((e) => {
        if (!active) return;
        if (tipo === "cotizacion") setQuote(e as QuoteRequest | null);
        else setReserva(e as Reserva | null);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tipo, id]);

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

  // Arranca el pago de la reserva: abre un chat de pago propio (tipo `pago`) y la
  // burbuja. El comprobante y la confirmación viven en ese hilo (PagoPanel).
  async function iniciarPagoReserva(metodo: MetodoPago) {
    if (!reserva) return;
    setShowPicker(false);
    try {
      const cid = await createPaymentConversation({
        uid: reserva.uid,
        concepto: "reserva",
        ref: { kind: "booking", id: reserva.id },
        metodo,
        monto: reserva.amount ?? 0,
      });
      openConversation(cid);
    } catch (e) {
      console.error("[reserva] iniciarPago:", e);
    }
  }

  // El cliente acepta/rechaza la propuesta del estudio. `aceptada` → una Cloud
  // Function genera la Reserva (con el precio propuesto, server-authoritative).
  async function responderCotizacion(status: "aceptada" | "rechazada") {
    if (!quote) return;
    setBusy(true);
    try {
      await updateQuoteStatus(quote.id, status);
      const fresh = await getQuoteById(quote.id);
      setQuote(fresh);
    } catch (e) {
      console.error("[cotizacion] responder:", e);
    } finally {
      setBusy(false);
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
        <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </section>
      </main>
    );
  }

  const entity = tipo === "cotizacion" ? quote : reserva;
  if (!entity) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-narrow text-3xl font-bold uppercase">
          {t("solicitudDetail.notFound")}
        </h1>
        <Link
          href="/solicitudes"
          className="border-silver-300/40 text-silver-100 hover:border-silver-100 mt-6 rounded-full border px-6 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
        >
          {t("solicitudDetail.backToRequests")}
        </Link>
      </main>
    );
  }

  const estado = tipo === "cotizacion" ? quote!.status : reserva!.estado;
  const label = t(`status.${estado}`);
  const sede = reserva ? sedes.find((s) => s.id === reserva.sede) : undefined;

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
          {tipo === "cotizacion"
            ? t("solicitudDetail.quote")
            : t("solicitudDetail.booking")}
        </h1>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs ${badgeClass(estado)}`}
        >
          {label}
        </span>
      </div>

      {/* Resumen */}
      <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
        {reserva && (
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-white">
              {reserva.serviceName}
            </p>
            {reserva.start > 0 && (
              <p className="text-silver-300">
                {new Date(reserva.start).toLocaleString(locale, {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </p>
            )}
            <p className="text-silver-300">
              {t("solicitudDetail.venue", {
                name: sede?.nombre ?? reserva.sede,
              })}
            </p>
            <p className="mt-1 font-semibold text-white">
              {formatCOP(reserva.amount ?? 0)}
            </p>
          </div>
        )}
        {quote && (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col gap-1">
              {quote.items.map((i, idx) => (
                <li key={idx} className="text-silver-100 flex justify-between">
                  <span>
                    {i.serviceName}{" "}
                    <span className="text-silver-400">× {i.quantity}</span>
                  </span>
                  <span>
                    {i.unitPrice != null
                      ? formatCOP(i.unitPrice * i.quantity)
                      : t("solicitudDetail.toQuote")}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-silver-300 border-t border-white/10 pt-2">
              {t("solicitudDetail.estimated", {
                amount: formatCOP(quote.estimatedTotal ?? 0),
              })}
              {quote.hasQuoteOnlyItems
                ? ` ${t("solicitudDetail.plusToQuote")}`
                : ""}
            </p>
          </div>
        )}
      </section>

      {/* Acción: aceptar/rechazar la propuesta del estudio */}
      {quote && quote.status === "cotizada" && (
        <section className="border-amethyst-300/30 bg-amethyst-500/10 mt-6 rounded-xl border p-4">
          <h2 className="font-narrow text-xl font-bold text-white uppercase">
            {t("solicitudDetail.proposalTitle")}
          </h2>
          {quote.proposedPrice != null && (
            <p className="font-narrow mt-1 text-3xl font-bold text-white">
              {formatCOP(quote.proposedPrice)}
            </p>
          )}
          <p className="text-silver-300 mt-1 text-sm">
            {t("solicitudDetail.proposalHint")}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              onClick={() => responderCotizacion("aceptada")}
              loading={busy}
            >
              {t("solicitudDetail.acceptProposal")}
            </Button>
            <button
              type="button"
              onClick={() => responderCotizacion("rechazada")}
              disabled={busy}
              className="text-silver-200 rounded-full border border-white/20 px-5 py-2.5 text-sm transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
            >
              {t("solicitudDetail.rejectProposal")}
            </button>
          </div>
        </section>
      )}

      {quote && quote.status === "aceptada" && (
        <p className="mt-6 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {t("solicitudDetail.quoteAcceptedNote")}
        </p>
      )}

      {/* Acción: pago de la reserva → abre un chat de pago propio */}
      {reserva && reserva.estado === "pendiente_pago" && (
        <section className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
          <h2 className="font-narrow text-xl font-bold text-white uppercase">
            {t("solicitudDetail.payment")}
          </h2>
          <p className="text-silver-300 mt-2 text-sm">
            {t("solicitudDetail.paymentStartHint")}
          </p>
          <Button className="mt-3" onClick={() => setShowPicker(true)}>
            {t("solicitudDetail.pay")}
          </Button>
        </section>
      )}

      {showPicker && (
        <PaymentMethodPicker
          onPick={iniciarPagoReserva}
          onClose={() => setShowPicker(false)}
          insignia={insignia}
        />
      )}

      {reserva && reserva.estado === "pago_en_revision" && (
        <p className="mt-6 rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
          {t("solicitudDetail.receiptUnderReview")}
        </p>
      )}

      {/* Hilo de soporte */}
      <section className="mt-8">
        <h2 className="font-narrow mb-3 text-xl font-bold text-white uppercase">
          {t("solicitudDetail.conversation")}
        </h2>
        {convId ? (
          <div className="flex h-[28rem] flex-col">
            <ConversationView conversationId={convId} />
          </div>
        ) : (
          <div className="flex h-[28rem] flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-4">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
            <Skeleton className="h-12 w-3/5" />
          </div>
        )}
      </section>
    </main>
  );
}
