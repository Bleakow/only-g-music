"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
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
import { MinusIcon, PlusIcon, CheckIcon, CloseIcon } from "@/components/icons";
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
import { getProfileBySlug } from "@/features/artists/lib/artist-profile-repo";

const TOTAL = 3;

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
  const t = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const { user, account } = useAuth();

  const STEPS = [
    t("quoteWizard.stepOrder"),
    t("quoteWizard.stepProject"),
    t("quoteWizard.stepContact"),
  ];

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
  const [collabs, setCollabs] = useState<QuoteCollaborator[]>([]);

  // Pre-llena el colaborador si se llega con ?colaborador=slug (botón "Cotizar
  // con" del perfil): busca el perfil REAL por slug en Firestore.
  useEffect(() => {
    const slug = params.get("colaborador");
    if (!slug) return;
    let active = true;
    getProfileBySlug(slug)
      .then((p) => {
        if (active && p)
          setCollabs([
            {
              id: p.slug,
              name: p.artisticName,
              ...(p.photoURL ? { image: p.photoURL } : {}),
            },
          ]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [params]);
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
      setError(t("quoteWizard.errorEmptyCart"));
      return;
    }
    if (step === 2 && !details.trim()) {
      setError(t("quoteWizard.errorEmptyDetails"));
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
      setError(t("quoteWizard.errorMissingContact"));
      return;
    }
    if (!user) {
      setError(t("quoteWizard.errorSessionExpired"));
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
        if (!isQuoteOnly(p) && p.basePrice != null)
          item.unitPrice = p.basePrice;
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
      setError(t("quoteWizard.errorSubmit"));
    } finally {
      setBusy(false);
    }
  }

  if (doneId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200 flex size-16 items-center justify-center rounded-full border">
          <CheckIcon className="size-8" />
        </div>
        <h1 className="font-narrow mt-6 text-4xl font-bold uppercase sm:text-5xl">
          {t("quoteWizard.successHeading")}
        </h1>
        <p className="text-silver-300 mt-3">
          {t("quoteWizard.successBody", { itemCount })}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/cuenta"
            className="from-silver-100 to-amethyst-300 text-ink rounded-full bg-gradient-to-r px-8 py-3 text-sm font-semibold tracking-[2px] uppercase transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
          >
            {t("quoteWizard.goToAccount")}
          </Link>
          <Link
            href="/"
            className="border-silver-300/40 text-silver-100 hover:border-silver-100 rounded-full border px-8 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
          >
            {t("quoteWizard.goHome")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto min-h-dvh max-w-2xl px-6 pt-28 pb-32 sm:px-12">
        <header className="mb-8">
          <p className="text-amethyst-300 text-sm tracking-[4px] uppercase">
            {t("quoteWizard.eyebrow")}
          </p>
          <h1 className="font-narrow mt-3 text-4xl font-bold uppercase sm:text-6xl">
            {t("quoteWizard.heading")}
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
          <p className="text-silver-400 mt-2 text-xs tracking-[2px] uppercase">
            {t("quoteWizard.stepIndicator", {
              step,
              total: TOTAL,
              stepName: STEPS[step - 1],
            })}
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
          {/* -- Paso 1: armar el pedido */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-silver-300">{t("quoteWizard.step1Intro")}</p>
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
                            <span className="font-narrow block text-xl leading-tight font-bold text-white uppercase">
                              {s.name}
                            </span>
                            <span className="text-silver-300 mt-1 block text-sm">
                              {s.description}
                            </span>
                            <span className="text-amethyst-200 mt-2 block text-sm font-semibold">
                              {variantsCard
                                ? active
                                  ? t("quoteWizard.variantCount", {
                                      count: serviceLines.length,
                                    })
                                  : t("quoteWizard.variantsCta")
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
                              <span className="text-silver-100 truncate text-sm">
                                {l.variant!.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setQty(l.key, l.qty - 1)}
                                  className={STEPPER}
                                  aria-label={t("quoteWizard.ariaRemoveOne")}
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
                                  aria-label={t("quoteWizard.ariaAddOne")}
                                >
                                  <PlusIcon className="size-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setModalSlug(s.slug)}
                            className="text-amethyst-300 hover:text-amethyst-200 self-start py-2 text-sm font-semibold transition"
                          >
                            {t("quoteWizard.changeOptions")}
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
                              aria-label={t("quoteWizard.ariaRemoveOne")}
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
                              aria-label={t("quoteWizard.ariaAddOne")}
                            >
                              <PlusIcon className="size-4" />
                            </button>
                            <span className="text-silver-400 ml-1 text-xs">
                              {unitLabel(s)}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-white">
                            {isQuoteOnly(s)
                              ? t("solicitudDetail.toQuote")
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
                    {t("quoteWizard.cartSummary", {
                      items: itemCount,
                      lines: lines.length,
                    })}
                  </span>
                  <span className="font-semibold text-white">
                    {t("quoteWizard.estimated")} {formatCOP(fixedTotal)}
                    {hasQuoteOnly && ` ${t("quoteWizard.plusToQuote")}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* -- Paso 2: proyecto + colaboradores */}
          {step === 2 && (
            <>
              <label className={LABEL}>
                <span className={LABEL_TEXT}>
                  {t("quoteWizard.labelProjectDetails")}
                </span>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  placeholder={t("quoteWizard.placeholderProjectDetails")}
                  className={INPUT}
                  required
                />
              </label>

              <div className={LABEL}>
                <span className={LABEL_TEXT}>
                  {t("quoteWizard.labelReferences")}
                </span>
                <FileUpload value={attachments} onChange={setAttachments}>
                  <input
                    type="text"
                    value={references}
                    onChange={(e) => setReferences(e.target.value)}
                    placeholder={t("quoteWizard.placeholderReferences")}
                    className="text-silver-50 flex-1 bg-transparent px-4 py-2.5 outline-none"
                  />
                </FileUpload>
              </div>

              <div className={LABEL}>
                <span className={LABEL_TEXT}>
                  {t("quoteWizard.labelArtists")}
                </span>
                <ArtistPicker value={collabs} onChange={setCollabs} />
              </div>

              <fieldset className={LABEL}>
                <span className={LABEL_TEXT}>
                  {t("quoteWizard.labelVenue")}
                </span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sedes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSede(s.id)}
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        sede === s.id
                          ? "border-amethyst-300 bg-amethyst-500/10 text-white"
                          : "text-silver-200 border-white/15 bg-black/30 hover:border-white/40"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {s.nombre}
                      </span>
                      <span className="text-silver-400 block text-xs">
                        {s.ciudad}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {/* -- Paso 3: resumen + contacto */}
          {step === 3 && (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-silver-400 text-xs tracking-[2px] uppercase">
                  {t("quoteWizard.orderSummaryHeading")}
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
                            ? t("solicitudDetail.toQuote")
                            : formatCOP((p.basePrice ?? 0) * l.qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                  <span className="text-silver-300">
                    {t("quoteWizard.totalEstimated")}
                  </span>
                  <span className="font-semibold text-white">
                    {t("quoteWizard.estimated")} {formatCOP(fixedTotal)}
                    {hasQuoteOnly && ` ${t("quoteWizard.plusToQuote")}`}
                  </span>
                </div>
                {collabs.length > 0 && (
                  <p className="text-silver-400 mt-3 text-xs">
                    {t("quoteWizard.artistsPrefix", {
                      names: collabs.map((c) => c.name).join(", "),
                    })}
                  </p>
                )}
                {attachments.length > 0 && (
                  <p className="text-silver-400 mt-1 text-xs">
                    {t("quoteWizard.attachmentsCount", {
                      count: attachments.length,
                    })}
                  </p>
                )}
              </div>

              <label className={LABEL}>
                <span className={LABEL_TEXT}>
                  {t("quoteWizard.labelBudget")}
                </span>
                <div className="relative">
                  <span className="text-silver-400 pointer-events-none absolute top-1/2 left-4 -translate-y-1/2">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      budget
                        ? new Intl.NumberFormat(locale).format(Number(budget))
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
                <span className={LABEL_TEXT}>{t("quoteWizard.labelName")}</span>
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
                <span className={LABEL_TEXT}>
                  {t("quoteWizard.labelEmail")}
                </span>
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
                  {t("quoteWizard.labelPhone")}
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
                className="border-silver-300/40 text-silver-100 hover:border-silver-100 rounded-full border px-6 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
              >
                {t("quoteWizard.back")}
              </button>
            ) : (
              <span />
            )}

            <button
              type="submit"
              disabled={busy}
              className="from-silver-100 to-amethyst-300 text-ink rounded-full bg-gradient-to-r px-8 py-3 text-sm font-semibold tracking-[2px] uppercase transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? t("quoteWizard.sending")
                : step < TOTAL
                  ? t("quoteWizard.next")
                  : t("quoteWizard.submit")}
            </button>
          </div>
        </form>
      </main>

      {/* -- Panel de opciones (variantes) */}
      {modalService && modalService.variants && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 sm:items-center sm:p-6"
          onClick={() => setModalSlug(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="variant-modal-title"
        >
          <div
            className="bg-ink-soft max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="variant-modal-title"
                  className="font-narrow text-2xl font-bold text-white uppercase"
                >
                  {modalService.name}
                </h2>
                <p className="text-silver-300 mt-1 text-sm">
                  {t("quoteWizard.modalVariantSubtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalSlug(null)}
                aria-label={t("quoteWizard.ariaCloseModal")}
                className="text-silver-200 flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 transition hover:border-white hover:text-white"
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
                          <p className="text-silver-300 mt-0.5 text-sm">
                            {v.description}
                          </p>
                        )}
                        <p className="text-amethyst-200 mt-1 text-sm font-semibold">
                          {priceLabel(v)}
                        </p>
                      </div>
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => setQty(key, 1)}
                          className="border-amethyst-400/60 text-amethyst-200 hover:border-amethyst-300 hover:bg-amethyst-500/10 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition hover:text-white"
                        >
                          {t("quoteWizard.variantAdd")}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQty(key, qty - 1)}
                            className={STEPPER}
                            aria-label={t("quoteWizard.ariaRemoveOne")}
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
                            aria-label={t("quoteWizard.ariaAddOne")}
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
              className="from-silver-100 to-amethyst-300 text-ink mt-6 w-full rounded-full bg-gradient-to-r px-6 py-3 text-sm font-semibold tracking-[2px] uppercase transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
            >
              {t("quoteWizard.modalDone")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
