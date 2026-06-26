"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  getQuoteById,
  updateQuoteStatus,
  setQuoteProposal,
} from "@/features/quotes/lib/quotes-repo";
import {
  getReservaById,
  updateBookingEstado,
  setBookingProductor,
} from "@/features/booking/lib/booking-repo";
import { getSesionByReserva } from "@/features/booking/lib/sessions-repo";
import {
  ensureSupportConversation,
  sendConversationMessage,
} from "@/features/conversations/lib/conversations-repo";
import { ConversationView } from "@/features/conversations/components/ConversationView";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { formatCOP } from "@/domain/service";
import { sedes } from "@/features/sedes/data/sedes";
import {
  nextQuoteStates,
  type QuoteRequest,
  type QuoteStatus,
} from "@/domain/quote";
import {
  nextReservaStates,
  type Reserva,
  type ReservaEstado,
  type Sesion,
} from "@/domain/booking";
import { badgeClass } from "@/features/solicitudes/lib/estados";

type Tipo = "cotizacion" | "reserva";

export function AdminSolicitudDetail({ tipo, id }: { tipo: Tipo; id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useAuth();
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState("");
  const [propText, setPropText] = useState("");
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [productorIdInput, setProductorIdInput] = useState("");
  const [convId, setConvId] = useState<string | null>(null);

  const parent = tipo === "cotizacion" ? "quotes" : "bookings";
  const ownerUid = quote?.uid ?? reserva?.uid ?? null;

  // Asegura el chat de soporte (el dueño de la solicitud es el participante).
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

  async function reload() {
    if (tipo === "cotizacion") {
      setQuote(await getQuoteById(id));
    } else {
      const r = await getReservaById(id);
      setReserva(r);
      if (r && r.tipo !== "perfil_artista") {
        setSesion(await getSesionByReserva(id));
      }
    }
  }

  async function asignarProductor() {
    if (!reserva || !productorIdInput.trim()) return;
    setBusy(true);
    try {
      await setBookingProductor(id, productorIdInput.trim());
      setProductorIdInput("");
      await reload();
    } catch (e) {
      console.error("[admin] asignar productor:", e);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    reload().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, id]);

  async function enviarPropuesta() {
    if (!quote) return;
    setBusy(true);
    try {
      const cid =
        convId ?? (await ensureSupportConversation("quotes", id, quote.uid));
      await sendConversationMessage(cid, {
        from: user?.uid ?? "estudio",
        tipo: "propuesta",
        price: price ? Number(price) : undefined,
        // Sin texto fijo: el chat ya muestra el encabezado "Propuesta · $X"
        // traducido al idioma del cliente. Si el admin escribe algo, va tal cual.
        texto: propText.trim() || undefined,
      });
      await setQuoteProposal(id, price ? Number(price) : undefined);
      setPrice("");
      setPropText("");
      await reload();
    } catch (e) {
      console.error("[admin] error:", e);
    } finally {
      setBusy(false);
    }
  }

  async function cambiarQuote(st: QuoteStatus) {
    setBusy(true);
    try {
      await updateQuoteStatus(id, st);
      if (convId) {
        await sendConversationMessage(convId, {
          from: "sistema",
          tipo: "estado",
          estado: st,
        });
      }
      await reload();
    } catch (e) {
      console.error("[admin] error:", e);
    } finally {
      setBusy(false);
    }
  }

  async function cambiarReserva(st: ReservaEstado) {
    setBusy(true);
    try {
      await updateBookingEstado(id, st);
      if (convId) {
        await sendConversationMessage(convId, {
          from: "sistema",
          tipo: "estado",
          estado: st,
        });
      }
      await reload();
    } catch (e) {
      console.error("[admin] error:", e);
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
          {t("adminSolicitud.notFound")}
        </h1>
        <Link
          href="/admin"
          className="mt-6 rounded-full border border-silver-300/40 px-6 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
        >
          {t("adminSolicitud.backToPanel")}
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
        href="/admin"
        className="text-sm text-silver-300 underline-offset-4 hover:text-white hover:underline"
      >
        ← {t("userMenu.adminPanel")}
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
        {quote && (
          <div className="flex flex-col gap-2">
            <p className="text-silver-300">
              {quote.contactName} · {quote.contactEmail}
              {quote.contactPhone ? ` · ${quote.contactPhone}` : ""}
            </p>
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
            {quote.details && (
              <p className="text-silver-300">“{quote.details}”</p>
            )}
            {quote.budget && (
              <p className="text-silver-400">
                {t("adminSolicitud.clientBudget", { budget: quote.budget })}
              </p>
            )}
            {quote.collaborators && quote.collaborators.length > 0 && (
              <p className="text-silver-400">
                {t("adminSolicitud.artists", {
                  names: quote.collaborators.map((c) => c.name).join(", "),
                })}
              </p>
            )}
          </div>
        )}
        {reserva && (
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-white">
              {reserva.serviceName}
            </p>
            <p className="text-silver-300">
              {new Date(reserva.start).toLocaleString(locale, {
                dateStyle: "long",
                timeStyle: "short",
              })}{" "}
              · {sede?.nombre ?? reserva.sede}
            </p>
            <p className="font-semibold text-white">
              {formatCOP(reserva.amount ?? 0)}
            </p>
            {reserva.comprobanteUrl && (
              <a
                href={reserva.comprobanteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-amethyst-200 underline underline-offset-2 hover:text-white"
              >
                {t("adminSolicitud.viewReceipt")}
              </a>
            )}
            {reserva.tipo === "perfil_artista" && (
              <p className="mt-1 rounded-lg border border-amethyst-300/30 bg-amethyst-500/10 px-3 py-2 text-xs text-amethyst-100">
                {t.rich("adminSolicitud.artistProfileNote", {
                  strong: (chunks) => <strong>{chunks}</strong>,
                  code: (chunks) => <code>{chunks}</code>,
                  link: (chunks) => (
                    <Link
                      href="/admin/perfiles"
                      className="underline underline-offset-2"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Acciones */}
      <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 font-narrow text-xl font-bold uppercase text-white">
          {t("adminSolicitud.actions")}
        </h2>

        {quote && (quote.status === "pendiente" || quote.status === "cotizada") && (
          <div className="mb-4 flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[2px] text-silver-300">
              {t("adminSolicitud.sendProposal")}
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-silver-400">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={
                  price
                    ? new Intl.NumberFormat(locale).format(Number(price))
                    : ""
                }
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
                placeholder={t("adminSolicitud.proposedPrice")}
                className="w-full rounded-lg border border-white/15 bg-black/30 py-2.5 pl-7 pr-4 text-sm tabular-nums text-silver-50 outline-none focus:border-amethyst-300"
              />
            </div>
            <textarea
              value={propText}
              onChange={(e) => setPropText(e.target.value)}
              rows={2}
              placeholder={t("adminSolicitud.proposalDetail")}
              className="w-full rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-silver-50 outline-none focus:border-amethyst-300"
            />
            <Button onClick={enviarPropuesta} loading={busy} className="self-start">
              {t("adminSolicitud.sendProposal")}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {quote &&
            nextQuoteStates(quote.status)
              .filter((s) => s !== "cotizada")
              .map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === "rechazada" ? "danger" : "secondary"}
                  onClick={() => cambiarQuote(s)}
                  loading={busy}
                >
                  {t("adminSolicitud.markAs", {
                    status: t(`status.${s}`).toLowerCase(),
                  })}
                </Button>
              ))}
          {reserva &&
            nextReservaStates(reserva.estado)
              // Un perfil no tiene sesión: en_curso/completada no aplican.
              .filter(
                (s) =>
                  reserva.tipo !== "perfil_artista" ||
                  (s !== "en_curso" && s !== "completada"),
              )
              .map((s) => (
              <Button
                key={s}
                size="sm"
                variant={
                  s === "confirmada"
                    ? "primary"
                    : s === "cancelada"
                      ? "danger"
                      : "secondary"
                }
                onClick={() => cambiarReserva(s)}
                loading={busy}
              >
                {t(`status.${s}`)}
              </Button>
            ))}
          {quote &&
            nextQuoteStates(quote.status).filter((s) => s !== "cotizada")
              .length === 0 &&
            quote.status !== "pendiente" &&
            quote.status !== "cotizada" && (
              <p className="text-sm text-silver-400">Sin acciones disponibles.</p>
            )}
          {reserva && nextReservaStates(reserva.estado).length === 0 && (
            <p className="text-sm text-silver-400">Estado final.</p>
          )}
        </div>
      </section>

      {/* Sesión del productor (solo reservas de estudio, no perfiles) */}
      {reserva && reserva.tipo !== "perfil_artista" && (
        <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 font-narrow text-xl font-bold uppercase text-white">
            {t("adminSolicitud.producerSession")}
          </h2>
          {sesion ? (
            <p className="text-sm text-silver-300">
              {t("adminSolicitud.sessionCreated")}{" "}
              <code className="text-amethyst-200">{sesion.productorId}</code> ·{" "}
              {t(`status.${sesion.estado}`)}
            </p>
          ) : reserva.productorId ? (
            <p className="text-sm text-silver-300">
              {t("adminSolicitud.producerAssigned")}{" "}
              <code className="text-amethyst-200">{reserva.productorId}</code>.{" "}
              {t("adminSolicitud.sessionAutoCreated")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-silver-400">
                {t("adminSolicitud.assignProducerHint")}
              </p>
              <input
                value={productorIdInput}
                onChange={(e) => setProductorIdInput(e.target.value)}
                placeholder={t("adminSolicitud.producerUidPlaceholder")}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-silver-50 outline-none focus:border-amethyst-300"
              />
              <Button
                onClick={asignarProductor}
                loading={busy}
                disabled={!productorIdInput.trim()}
                className="self-start"
              >
                {t("adminSolicitud.assignProducer")}
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Hilo */}
      <section className="mt-8">
        <h2 className="mb-3 font-narrow text-xl font-bold uppercase text-white">
          {t("adminSolicitud.conversationWithClient")}
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
