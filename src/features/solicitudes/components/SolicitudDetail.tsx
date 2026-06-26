"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  getQuoteById,
  updateQuoteStatus,
} from "@/features/quotes/lib/quotes-repo";
import {
  getReservaById,
  marcarPagoEnRevision,
} from "@/features/booking/lib/booking-repo";
import {
  ensureSupportConversation,
  sendConversationMessage,
} from "@/features/conversations/lib/conversations-repo";
import { ConversationView } from "@/features/conversations/components/ConversationView";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import { sedes } from "@/features/sedes/data/sedes";
import { formatCOP } from "@/domain/service";
import type { QuoteRequest } from "@/domain/quote";
import type { Reserva } from "@/domain/booking";
import { badgeClass } from "../lib/estados";

type Tipo = "cotizacion" | "reserva";

export function SolicitudDetail({ tipo, id }: { tipo: Tipo; id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [loading, setLoading] = useState(true);
  const [comprobante, setComprobante] = useState<UploadedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);

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
    const load =
      tipo === "cotizacion" ? getQuoteById(id) : getReservaById(id);
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

  async function enviarComprobante() {
    if (!reserva || !comprobante[0]) return;
    setBusy(true);
    try {
      await marcarPagoEnRevision(reserva.id, comprobante[0].url);
      const cid =
        convId ??
        (await ensureSupportConversation("bookings", reserva.id, reserva.uid));
      await sendConversationMessage(cid, {
        from: reserva.uid,
        tipo: "comprobante",
        texto: t("solicitudDetail.receiptMessage"),
        attachmentUrl: comprobante[0].url,
        attachmentName: comprobante[0].name,
      });
      const fresh = await getReservaById(reserva.id);
      setReserva(fresh);
      setComprobante([]);
    } catch (e) {
      console.error("[comprobante] error:", e);
    } finally {
      setBusy(false);
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
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-silver-300">{t("common.loading")}</p>
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
          className="mt-6 rounded-full border border-silver-300/40 px-6 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
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
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pb-24 pt-28 sm:px-12">
      <Link
        href="/solicitudes"
        className="text-sm text-silver-300 underline-offset-4 hover:text-white hover:underline"
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
                <li key={idx} className="flex justify-between text-silver-100">
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
            <p className="border-t border-white/10 pt-2 text-silver-300">
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
        <section className="mt-6 rounded-xl border border-amethyst-300/30 bg-amethyst-500/10 p-4">
          <h2 className="font-narrow text-xl font-bold uppercase text-white">
            {t("solicitudDetail.proposalTitle")}
          </h2>
          {quote.proposedPrice != null && (
            <p className="mt-1 font-narrow text-3xl font-bold text-white">
              {formatCOP(quote.proposedPrice)}
            </p>
          )}
          <p className="mt-1 text-sm text-silver-300">
            {t("solicitudDetail.proposalHint")}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button onClick={() => responderCotizacion("aceptada")} loading={busy}>
              {t("solicitudDetail.acceptProposal")}
            </Button>
            <button
              type="button"
              onClick={() => responderCotizacion("rechazada")}
              disabled={busy}
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-silver-200 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
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

      {/* Acción: pago de la reserva */}
      {reserva && reserva.estado === "pendiente_pago" && (
        <section className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
          <h2 className="font-narrow text-xl font-bold uppercase text-white">
            {t("solicitudDetail.payment")}
          </h2>
          {sede?.qrPagoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sede.qrPagoUrl}
              alt={t("solicitudDetail.qrAlt")}
              className="mt-3 size-44 rounded-lg object-contain"
            />
          ) : (
            <p className="mt-2 text-sm text-silver-300">
              {t("solicitudDetail.paymentInfo")}
            </p>
          )}
          <div className="mt-3">
            <FileUpload
              value={comprobante}
              onChange={setComprobante}
              accept="image/*,application/pdf"
            />
          </div>
          <Button
            className="mt-3"
            onClick={enviarComprobante}
            loading={busy}
            disabled={comprobante.length === 0}
          >
            {t("solicitudDetail.sendReceipt")}
          </Button>
        </section>
      )}

      {reserva && reserva.estado === "pago_en_revision" && (
        <p className="mt-6 rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
          {t("solicitudDetail.receiptUnderReview")}
        </p>
      )}

      {/* Hilo */}
      <section className="mt-8">
        <h2 className="mb-3 font-narrow text-xl font-bold uppercase text-white">
          {t("solicitudDetail.conversation")}
        </h2>
        {convId ? (
          <div className="flex h-[28rem] flex-col">
            <ConversationView conversationId={convId} />
          </div>
        ) : (
          <p className="text-sm text-silver-400">{t("common.loading")}</p>
        )}
      </section>
    </main>
  );
}
