"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { services } from "@/features/services/data/services";
import {
  isQuoteOnly,
  priceLabel,
  formatCOP,
  unitLabel,
  hasVariants,
  type Service,
  type ServiceVariant,
} from "@/domain/service";
import {
  MinusIcon,
  PlusIcon,
  CheckIcon,
  CloseIcon,
} from "@/components/icons";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { ArtistPicker } from "./ArtistPicker";
import { createQuoteRequest } from "../lib/quotes-repo";
import {
  type NewQuoteRequest,
  type QuoteItem,
  type QuoteCollaborator,
} from "@/domain/quote";
import type { SedeId } from "@/domain/sede";
import { sedes } from "@/features/sedes/data/sedes";
import { artists } from "@/features/artists/data/artists";

const STEPS = ["Tu pedido", "Tu proyecto", "Contacto"];
const TOTAL = STEPS.length;

const INPUT =
  "w-full rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80";
const LABEL = "flex flex-col gap-1.5 text-left";
const LABEL_TEXT = "text-xs uppercase tracking-[2px] text-silver-300";
const STEPPER =
  "flex size-10 items-center justify-center rounded-full border border-white/25 text-silver-100 transition hover:border-amethyst-300 hover:text-white";

type Line = {
  key: string;
  service: Service;
  variant?: ServiceVariant;
  qty: number;
};

const keyOf = (slug: string, variantId?: string) =>
  variantId ? `${slug}::${variantId}` : slug;

export function QuoteWizard() {
  const params = useSearchParams();
  const { user, account } = useAuth();

  const initialService = (() => {
    const slug = params.get("servicio");
    return slug ? services.find((s) => s.slug === slug) : undefined;
  })();

  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<Record<string, number>>(() =>
    initialService && !hasVariants(initialService)
      ? { [initialService.slug]: 1 }
      : {},
  );
  const [modalSlug, setModalSlug] = useState<string | null>(
    initialService && hasVariants(initialService) ? initialService.slug : null,
  );
  const [details, setDetails] = useState("");
  const [references, setReferences] = useState("");
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [collabs, setCollabs] = useState<QuoteCollaborator[]>(() => {
    const slug = params.get("colaborador");
    const a = slug ? artists.find((x) => x.slug === slug) : undefined;
    return a
      ? [{ id: a.slug, name: a.name, ...(a.image ? { image: a.image } : {}) }]
      : [];
  });
  const [sede, setSede] = useState<SedeId>("barranquilla");
  const [budget, setBudget] = useState("");
  const [contactName, setContactName] = useState(
    account?.displayName ?? user?.displayName ?? "",
  );
  const [contactEmail, setContactEmail] = useState(
    account?.email ?? user?.email ?? "",
  );
  const [contactPhone, setContactPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  const lines: Line[] = [];
  for (const [key, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const [slug, variantId] = key.split("::");
    const service = services.find((s) => s.slug === slug);
    if (!service) continue;
    const variant = variantId
      ? service.variants?.find((v) => v.id === variantId)
      : undefined;
    lines.push({ key, service, variant, qty });
  }

  const fixedTotal = lines.reduce((sum, l) => {
    const p = l.variant ?? l.service;
    return sum + (isQuoteOnly(p) ? 0 : (p.basePrice ?? 0) * l.qty);
  }, 0);
  const hasQuoteOnly = lines.some((l) => isQuoteOnly(l.variant ?? l.service));
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);

  const modalService = modalSlug
    ? (services.find((s) => s.slug === modalSlug) ?? null)
    : null;

  function setQty(key: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[key];
      else next[key] = Math.min(qty, 99);
      return next;
    });
  }

  function toggle(slug: string) {
    setCart((c) => {
      const next = { ...c };
      if (next[slug]) delete next[slug];
      else next[slug] = 1;
      return next;
    });
  }

  function next() {
    setError(null);
    if (step === 1 && lines.length === 0) {
      setError("Agrega al menos un servicio a tu pedido.");
      return;
    }
    if (step === 2 && !details.trim()) {
      setError("Cuéntanos un poco sobre tu proyecto.");
      return;
    }
    setStep((s) => Math.min(TOTAL, s + 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    setError(null);
    if (!contactName.trim() || !contactEmail.trim()) {
      setError("Necesitamos tu nombre y tu correo para responderte.");
      return;
    }
    if (!user) {
      setError("Tu sesión expiró. Inicia sesión de nuevo.");
      return;
    }
    setBusy(true);
    try {
      const items: QuoteItem[] = lines.map((l) => {
        const p = l.variant ?? l.service;
        const item: QuoteItem = {
          serviceSlug: l.service.slug,
          serviceName: l.variant
            ? `${l.service.name} — ${l.variant.name}`
            : l.service.name,
          quantity: l.qty,
        };
        if (l.variant) item.variantId = l.variant.id;
        if (!isQuoteOnly(p) && p.basePrice != null) item.unitPrice = p.basePrice;
        return item;
      });

      const payload: NewQuoteRequest = {
        uid: user.uid,
        items,
        collaborators: collabs.length ? collabs : undefined,
        details: details.trim(),
        references: references.trim() || undefined,
        attachments: attachments.length ? attachments : undefined,
        sede,
        budget: budget ? formatCOP(Number(budget)) : undefined,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim() || undefined,
        estimatedTotal: fixedTotal > 0 ? fixedTotal : undefined,
        hasQuoteOnlyItems: hasQuoteOnly,
      };

      const id = await createQuoteRequest(payload);
      setDoneId(id);
    } catch (e) {
      console.error("[cotizar] error:", e);
      setError(
        "No se pudo enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (doneId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200">
          <CheckIcon className="size-8" />
        </div>
        <h1 className="mt-6 font-narrow text-4xl font-bold uppercase sm:text-5xl">
          ¡Solicitud enviada!
        </h1>
        <p className="mt-3 text-silver-300">
          Recibimos tu pedido ({itemCount} ítem{itemCount !== 1 ? "s" : ""}). El
          equipo de Only G lo revisará y te enviará una propuesta con precio y
          alcance.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/cuenta"
            className="rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-8 py-3 text-sm font-semibold uppercase tracking-[2px] text-ink transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
          >
            Ir a mi cuenta
          </Link>
          <Link
            href="/"
            className="rounded-full border border-silver-300/40 px-8 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto min-h-dvh max-w-2xl px-6 pb-32 pt-28 sm:px-12">
        <header className="mb-8">
          <p className="text-sm uppercase tracking-[4px] text-amethyst-300">
            Cotización
          </p>
          <h1 className="mt-3 font-narrow text-4xl font-bold uppercase sm:text-6xl">
            Arma tu cotización
          </h1>

          <div className="mt-6 flex items-center gap-2">
            {STEPS.map((label, i) => (
              <span
                key={label}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < step ? "bg-amethyst-300" : "bg-white/10"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs uppercase tracking-[2px] text-silver-400">
            Paso {step} de {TOTAL} · {STEPS[step - 1]}
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < TOTAL) next();
            else submit();
          }}
          className="flex flex-col gap-5"
        >
          {/* ── Paso 1: armar el pedido ───────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-silver-300">
                Elige uno o varios servicios y ajusta las cantidades. Algunos
                tienen opciones (por horas, por día, agrupación…).
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {services.map((s) => {
                  const variantsCard = hasVariants(s);
                  const serviceLines = lines.filter(
                    (l) => l.service.slug === s.slug,
                  );
                  const qty = cart[s.slug] ?? 0;
                  const active = variantsCard
                    ? serviceLines.length > 0
                    : qty > 0;

                  return (
                    <div
                      key={s.slug}
                      className={`overflow-hidden rounded-2xl border transition ${
                        active
                          ? "border-amethyst-300 bg-amethyst-500/10 shadow-[0_0_20px_rgba(139,92,246,0.18)]"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          variantsCard ? setModalSlug(s.slug) : toggle(s.slug)
                        }
                        className="block w-full text-left"
                      >
                        {s.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.image}
                            alt=""
                            className="h-40 w-full object-cover"
                          />
                        )}
                        <div className="flex items-start gap-3 p-4">
                          <span className="block flex-1">
                            <span className="block font-narrow text-xl font-bold uppercase leading-tight text-white">
                              {s.name}
                            </span>
                            <span className="mt-1 block text-sm text-silver-300">
                              {s.description}
                            </span>
                            <span className="mt-2 block text-sm font-semibold text-amethyst-200">
                              {variantsCard
                                ? active
                                  ? `${serviceLines.length} opción${serviceLines.length !== 1 ? "es" : ""}`
                                  : "Varias opciones →"
                                : priceLabel(s)}
                            </span>
                          </span>
                          {!variantsCard && (
                            <span
                              className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition ${
                                active
                                  ? "border-amethyst-300 bg-amethyst-300 text-ink"
                                  : "border-white/30 text-transparent"
                              }`}
                            >
                              <CheckIcon className="size-4" />
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Controles de cantidad / variantes */}
                      {variantsCard && active && (
                        <div className="flex flex-col gap-2 border-t border-white/10 p-4 pt-3">
                          {serviceLines.map((l) => (
                            <div
                              key={l.key}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="truncate text-sm text-silver-100">
                                {l.variant!.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setQty(l.key, l.qty - 1)}
                                  className={STEPPER}
                                  aria-label="Quitar uno"
                                >
                                  <MinusIcon className="size-4" />
                                </button>
                                <span className="min-w-[2ch] text-center text-sm font-semibold text-white">
                                  {l.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setQty(l.key, l.qty + 1)}
                                  className={STEPPER}
                                  aria-label="Agregar uno"
                                >
                                  <PlusIcon className="size-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setModalSlug(s.slug)}
                            className="self-start py-2 text-sm font-semibold text-amethyst-300 transition hover:text-amethyst-200"
                          >
                            Agregar / cambiar opciones
                          </button>
                        </div>
                      )}

                      {!variantsCard && active && (
                        <div className="flex items-center justify-between border-t border-white/10 p-4 pt-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setQty(s.slug, qty - 1)}
                              className={STEPPER}
                              aria-label="Quitar uno"
                            >
                              <MinusIcon className="size-4" />
                            </button>
                            <span className="min-w-[2ch] text-center font-semibold text-white">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => setQty(s.slug, qty + 1)}
                              className={STEPPER}
                              aria-label="Agregar uno"
                            >
                              <PlusIcon className="size-4" />
                            </button>
                            <span className="ml-1 text-xs text-silver-400">
                              {unitLabel(s)}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-white">
                            {isQuoteOnly(s)
                              ? "A cotizar"
                              : formatCOP((s.basePrice ?? 0) * qty)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {lines.length > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                  <span className="text-silver-300">
                    {itemCount} ítem{itemCount !== 1 ? "s" : ""} ·{" "}
                    {lines.length} línea{lines.length !== 1 ? "s" : ""}
                  </span>
                  <span className="font-semibold text-white">
                    Estimado: {formatCOP(fixedTotal)}
                    {hasQuoteOnly && " + a cotizar"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Paso 2: proyecto + colaboradores ──────────────────── */}
          {step === 2 && (
            <>
              <label className={LABEL}>
                <span className={LABEL_TEXT}>Cuéntanos sobre tu proyecto</span>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  placeholder="Género, objetivo, fecha tentativa, lo que necesitas…"
                  className={INPUT}
                  required
                />
              </label>

              <div className={LABEL}>
                <span className={LABEL_TEXT}>
                  Referencias / instrumentales (links o archivos)
                </span>
                <FileUpload value={attachments} onChange={setAttachments}>
                  <input
                    type="text"
                    value={references}
                    onChange={(e) => setReferences(e.target.value)}
                    placeholder="URLs de ejemplos, instrumentales…"
                    className="flex-1 bg-transparent px-4 py-2.5 text-silver-50 outline-none"
                  />
                </FileUpload>
              </div>

              <div className={LABEL}>
                <span className={LABEL_TEXT}>
                  Invitar artistas — solo artistas registrados
                </span>
                <ArtistPicker value={collabs} onChange={setCollabs} />
              </div>

              <fieldset className={LABEL}>
                <span className={LABEL_TEXT}>Sede</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sedes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSede(s.id)}
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        sede === s.id
                          ? "border-amethyst-300 bg-amethyst-500/10 text-white"
                          : "border-white/15 bg-black/30 text-silver-200 hover:border-white/40"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {s.nombre}
                      </span>
                      <span className="block text-xs text-silver-400">
                        {s.ciudad}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {/* ── Paso 3: resumen + contacto ────────────────────────── */}
          {step === 3 && (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-xs uppercase tracking-[2px] text-silver-400">
                  Resumen del pedido
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {lines.map((l) => {
                    const p = l.variant ?? l.service;
                    return (
                      <li
                        key={l.key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-silver-100">
                          {l.service.name}
                          {l.variant ? ` — ${l.variant.name}` : ""}{" "}
                          <span className="text-silver-400">× {l.qty}</span>
                        </span>
                        <span className="font-semibold text-white">
                          {isQuoteOnly(p)
                            ? "A cotizar"
                            : formatCOP((p.basePrice ?? 0) * l.qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                  <span className="text-silver-300">Total estimado</span>
                  <span className="font-semibold text-white">
                    {formatCOP(fixedTotal)}
                    {hasQuoteOnly && " + a cotizar"}
                  </span>
                </div>
                {collabs.length > 0 && (
                  <p className="mt-3 text-xs text-silver-400">
                    Artistas: {collabs.map((c) => c.name).join(", ")}
                  </p>
                )}
                {attachments.length > 0 && (
                  <p className="mt-1 text-xs text-silver-400">
                    {attachments.length} archivo
                    {attachments.length !== 1 ? "s" : ""} adjunto
                    {attachments.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              <label className={LABEL}>
                <span className={LABEL_TEXT}>
                  Presupuesto aproximado (opcional)
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-silver-400">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      budget
                        ? new Intl.NumberFormat("es-CO").format(Number(budget))
                        : ""
                    }
                    onChange={(e) =>
                      setBudget(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="500.000"
                    className={`${INPUT} pl-8 tabular-nums`}
                  />
                </div>
              </label>

              <label className={LABEL}>
                <span className={LABEL_TEXT}>Nombre</span>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  autoComplete="name"
                  className={INPUT}
                  required
                />
              </label>
              <label className={LABEL}>
                <span className={LABEL_TEXT}>Correo</span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  autoComplete="email"
                  className={INPUT}
                  required
                />
              </label>
              <label className={LABEL}>
                <span className={LABEL_TEXT}>
                  Teléfono / WhatsApp (opcional)
                </span>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  autoComplete="tel"
                  className={INPUT}
                />
              </label>
            </>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={back}
                className="rounded-full border border-silver-300/40 px-6 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
              >
                Atrás
              </button>
            ) : (
              <span />
            )}

            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-8 py-3 text-sm font-semibold uppercase tracking-[2px] text-ink transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? "Enviando…"
                : step < TOTAL
                  ? "Siguiente"
                  : "Enviar solicitud"}
            </button>
          </div>
        </form>
      </main>

      {/* ── Panel de opciones (variantes) ─────────────────────────── */}
      {modalService && modalService.variants && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 sm:items-center sm:p-6"
          onClick={() => setModalSlug(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="variant-modal-title"
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-soft p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="variant-modal-title"
                  className="font-narrow text-2xl font-bold uppercase text-white"
                >
                  {modalService.name}
                </h2>
                <p className="mt-1 text-sm text-silver-300">
                  Elige una o varias opciones.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalSlug(null)}
                aria-label="Cerrar"
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-silver-200 transition hover:border-white hover:text-white"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {modalService.variants.map((v) => {
                const key = keyOf(modalService.slug, v.id);
                const qty = cart[key] ?? 0;
                return (
                  <div
                    key={v.id}
                    className={`rounded-xl border p-4 transition ${
                      qty > 0
                        ? "border-amethyst-300 bg-amethyst-500/10"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-white">{v.name}</p>
                        {v.description && (
                          <p className="mt-0.5 text-sm text-silver-300">
                            {v.description}
                          </p>
                        )}
                        <p className="mt-1 text-sm font-semibold text-amethyst-200">
                          {priceLabel(v)}
                        </p>
                      </div>
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => setQty(key, 1)}
                          className="shrink-0 rounded-full border border-amethyst-400/60 px-4 py-2 text-sm font-semibold text-amethyst-200 transition hover:border-amethyst-300 hover:bg-amethyst-500/10 hover:text-white"
                        >
                          Agregar
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQty(key, qty - 1)}
                            className={STEPPER}
                            aria-label="Quitar uno"
                          >
                            <MinusIcon className="size-4" />
                          </button>
                          <span className="min-w-[2ch] text-center font-semibold text-white">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQty(key, qty + 1)}
                            className={STEPPER}
                            aria-label="Agregar uno"
                          >
                            <PlusIcon className="size-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setModalSlug(null)}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-6 py-3 text-sm font-semibold uppercase tracking-[2px] text-ink transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
