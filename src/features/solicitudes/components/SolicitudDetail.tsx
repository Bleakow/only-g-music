"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getQuoteById } from "@/features/quotes/lib/quotes-repo";
import {
  getReservaById,
  marcarPagoEnRevision,
} from "@/features/booking/lib/booking-repo";
import { sendMessage } from "@/features/threads/lib/thread-repo";
import { Thread } from "@/features/threads/components/Thread";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import { sedes } from "@/features/sedes/data/sedes";
import { formatCOP } from "@/domain/service";
import type { QuoteRequest } from "@/domain/quote";
import type { Reserva } from "@/domain/booking";
import { QUOTE_LABEL, RESERVA_LABEL, badgeClass, fechaCorta } from "../lib/estados";

type Tipo = "cotizacion" | "reserva";

export function SolicitudDetail({ tipo, id }: { tipo: Tipo; id: string }) {
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [loading, setLoading] = useState(true);
  const [comprobante, setComprobante] = useState<UploadedFile[]>([]);
  const [busy, setBusy] = useState(false);

  const parent = tipo === "cotizacion" ? "quotes" : "bookings";

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
      await sendMessage("bookings", reserva.id, {
        from: "cliente",
        tipo: "comprobante",
        texto: "Envié el comprobante de pago.",
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

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-silver-300">Cargando…</p>
      </main>
    );
  }

  const entity = tipo === "cotizacion" ? quote : reserva;
  if (!entity) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-narrow text-3xl font-bold uppercase">
          Solicitud no encontrada
        </h1>
        <Link
          href="/solicitudes"
          className="mt-6 rounded-full border border-silver-300/40 px-6 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
        >
          Volver a mis solicitudes
        </Link>
      </main>
    );
  }

  const estado = tipo === "cotizacion" ? quote!.status : reserva!.estado;
  const label =
    tipo === "cotizacion"
      ? QUOTE_LABEL[quote!.status]
      : RESERVA_LABEL[reserva!.estado];
  const sede = reserva ? sedes.find((s) => s.id === reserva.sede) : undefined;

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pb-24 pt-28 sm:px-12">
      <Link
        href="/solicitudes"
        className="text-sm text-silver-300 underline-offset-4 hover:text-white hover:underline"
      >
        ← Mis solicitudes
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="font-narrow text-4xl font-bold uppercase sm:text-5xl">
          {tipo === "cotizacion" ? "Cotización" : "Reserva"}
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
            <p className="text-silver-300">
              {new Date(reserva.start).toLocaleString("es-CO", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
            <p className="text-silver-300">Sede: {sede?.nombre ?? reserva.sede}</p>
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
                      : "A cotizar"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-white/10 pt-2 text-silver-300">
              Estimado: {formatCOP(quote.estimatedTotal ?? 0)}
              {quote.hasQuoteOnlyItems ? " + a cotizar" : ""}
            </p>
          </div>
        )}
      </section>

      {/* Acción: pago de la reserva */}
      {reserva && reserva.estado === "pendiente_pago" && (
        <section className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
          <h2 className="font-narrow text-xl font-bold uppercase text-white">
            Pago
          </h2>
          {sede?.qrPagoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sede.qrPagoUrl}
              alt="QR de pago"
              className="mt-3 size-44 rounded-lg object-contain"
            />
          ) : (
            <p className="mt-2 text-sm text-silver-300">
              Te compartiremos los datos/QR de pago por el chat. Cuando pagues,
              sube aquí tu comprobante.
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
            Enviar comprobante
          </Button>
        </section>
      )}

      {reserva && reserva.estado === "pago_en_revision" && (
        <p className="mt-6 rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
          Recibimos tu comprobante. La administración lo está revisando; te
          confirmamos por el chat.
        </p>
      )}

      {/* Hilo */}
      <section className="mt-8">
        <h2 className="mb-3 font-narrow text-xl font-bold uppercase text-white">
          Conversación
        </h2>
        <Thread parent={parent} id={id} />
      </section>
    </main>
  );
}
