"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
} from "@only-g/shared-types/service";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MinusIcon, PlusIcon, CheckIcon } from "@/components/icons";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Alert } from "@/components/ui/Alert";
import { GlassModal } from "@/components/ui/GlassModal";
import { glassSurface, glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import {
  ServiceCard,
  ServiceCheckBadge,
} from "@/features/services/components/ServiceCard";
import { ArtistPicker } from "./ArtistPicker";
import { createQuoteRequest } from "../lib/quotes-repo";
import { track } from "@/lib/firebase/analytics";
import {
  type NewQuoteRequest,
  type QuoteItem,
  type QuoteCollaborator,
} from "@only-g/shared-types/quote";
import type { Sede, SedeId } from "@only-g/shared-types/sede";
import { sedes as seedSedes } from "@/features/sedes/data/sedes";
import { getAllSedes } from "@/features/sedes/lib/sedes-repo";
import { getProfileBySlug } from "@/features/artists/lib/artist-profile-repo";
import { useOnScreen } from "@/lib/use-on-screen";

const TOTAL = 3;

// Catálogo COTIZABLE: solo servicios de alcance variable (a medida). Excluye los
// de precio fijo (grabación, mezcla, máster) — esos van por compra directa
// (/comprar). Con variantes, se incluye si AL MENOS una es a-cotizar (p. ej. renta
// "varios días"); las variantes comprables se filtran dentro del modal.
const QUOTABLE = services.filter((s) =>
  hasVariants(s) ? (s.variants ?? []).some((v) => isQuoteOnly(v)) : isQuoteOnly(s),
);

const INPUT =
  "w-full rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80";
const LABEL = "flex flex-col gap-1.5 text-left";
const LABEL_TEXT = "text-xs uppercase tracking-[2px] text-silver-300";
const STEPPER = `${glassSurfaceSoft} flex size-10 items-center justify-center rounded-full text-silver-100 transition hover:text-white hover:ring-amethyst-300/70`;

type Line = {
  key: string;
  service: Service;
  variant?: ServiceVariant;
  qty: number;
};

const keyOf = (slug: string, variantId?: string) =>
  variantId ? `${slug}::${variantId}` : slug;

/** ¿La variante admite contador (+/-)? Ausente = sí; los tramos "1/2 artistas" no. */
const variantEsContable = (v: ServiceVariant) => v.countable !== false;

/**
 * Variantes que se muestran en el modal de COTIZACIÓN. La renta de estudio se
 * cotiza por DÍAS (1 día / varios días) igual que en compra → solo la variante
 * "dia" (con contador de días). El resto de servicios: sus variantes a-cotizar.
 */
const variantsCotizables = (s: Service): ServiceVariant[] => {
  if (s.slug === "renta-estudio") {
    return (s.variants ?? []).filter((v) => v.id === "dia");
  }
  return (s.variants ?? []).filter((v) => isQuoteOnly(v));
};

export function QuoteWizard() {
  const t = useTranslations();
  const reduce = useReducedMotion();
  const params = useSearchParams();
  const { user, account } = useAuth();
  // La barra flotante de "continuar" se oculta cuando el botón del final ya se ve.
  const { ref: footerRef, onScreen: footerOnScreen } =
    useOnScreen<HTMLDivElement>();

  const STEPS = [
    t("quoteWizard.stepOrder"),
    t("quoteWizard.stepProject"),
    t("quoteWizard.stepContact"),
  ];

  const initialService = (() => {
    const slug = params.get("servicio");
    return slug ? QUOTABLE.find((s) => s.slug === slug) : undefined;
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
  const [sedes, setSedes] = useState<Sede[]>(seedSedes);
  const [sede, setSede] = useState<SedeId>(seedSedes[0].id);

  // Sedes reales (semilla + creadas por el admin); arranca con la semilla
  // como fallback inmediato para no dejar el selector vacío.
  useEffect(() => {
    let active = true;
    getAllSedes()
      .then((data) => {
        if (active) setSedes(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
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
    const service = QUOTABLE.find((s) => s.slug === slug);
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
    ? (QUOTABLE.find((s) => s.slug === modalSlug) ?? null)
    : null;

  function setQty(key: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[key];
      else next[key] = Math.min(qty, 99);
      return next;
    });
  }

  /** Elige una variante de un servicio de ELECCIÓN ÚNICA (p. ej. producción):
   *  al marcar una, se quitan las otras del mismo servicio. */
  function selectExclusive(service: Service, key: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      for (const v of service.variants ?? []) {
        const k = keyOf(service.slug, v.id);
        if (k !== key) delete next[k];
      }
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
      track("quote_submitted");
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
            href={`/solicitudes/cotizacion/${doneId}`}
            className="btn-amethyst rounded-full px-8 py-3 text-sm font-semibold tracking-[2px] uppercase"
          >
            {t("quoteWizard.goToChat")}
          </Link>
          <Link
            href="/"
            className="btn-outline rounded-full px-8 py-3 text-sm tracking-[2px] uppercase"
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
                {QUOTABLE.map((s) => {
                  const variantsCard = hasVariants(s);
                  const serviceLines = lines.filter(
                    (l) => l.service.slug === s.slug,
                  );
                  const qty = cart[s.slug] ?? 0;
                  const active = variantsCard
                    ? serviceLines.length > 0
                    : qty > 0;

                  return (
                    <ServiceCard
                      key={s.slug}
                      service={s}
                      active={active}
                      priceLabel={
                        variantsCard
                          ? active
                            ? t("quoteWizard.variantCount", {
                                count: serviceLines.length,
                              })
                            : t("quoteWizard.variantsCta")
                          : priceLabel(s)
                      }
                      onSelect={() =>
                        variantsCard ? setModalSlug(s.slug) : toggle(s.slug)
                      }
                      indicator={
                        !variantsCard ? (
                          <ServiceCheckBadge active={active} />
                        ) : undefined
                      }
                    >
                      {active && (
                        <>
                          {variantsCard ? (
                            <div className="flex flex-col gap-2">
                              {serviceLines.map((l) => (
                                <div
                                  key={l.key}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <span className="text-silver-100 truncate text-sm">
                                    {l.variant!.name}
                                  </span>
                                  {variantEsContable(l.variant!) ? (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setQty(l.key, l.qty - 1)}
                                        className={STEPPER}
                                        aria-label={t(
                                          "quoteWizard.ariaRemoveOne",
                                        )}
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
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setQty(l.key, 0)}
                                      aria-label={t(
                                        "quoteWizard.variantRemove",
                                      )}
                                      className="text-silver-400 shrink-0 rounded-full px-2 py-1 text-xs transition hover:text-white"
                                    >
                                      {t("quoteWizard.variantRemove")}
                                    </button>
                                  )}
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
                          ) : (
                            <div className="flex items-center justify-between">
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
                        </>
                      )}
                    </ServiceCard>
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
                  <MoneyInput
                    value={budget}
                    onChange={setBudget}
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

          {error && <Alert tone="error">{error}</Alert>}

          <div
            ref={footerRef}
            className="mt-2 flex items-center justify-between gap-3"
          >
            {step > 1 ? (
              <button
                type="button"
                onClick={back}
                className="btn-outline rounded-full px-6 py-3 text-sm tracking-[2px] uppercase"
              >
                {t("quoteWizard.back")}
              </button>
            ) : (
              <span />
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-amethyst rounded-full px-8 py-3 text-sm font-semibold tracking-[2px] uppercase disabled:cursor-not-allowed disabled:opacity-60"
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

      {/* -- Barra flotante para continuar (paso 1): avanzar sin llegar al fondo */}
      {/* Se oculta cuando el botón real del final ya está en pantalla (no dos a la vez). */}
      <AnimatePresence>
        {step === 1 && lines.length > 0 && !footerOnScreen && (
          <motion.div
            initial={reduce ? false : { y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom))]"
          >
            <div
              className={`${glassSurface} pointer-events-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-full py-2 pr-2 pl-3 sm:pl-5`}
            >
              <GlassSheen />
              <span className="text-silver-100 flex items-center gap-2.5">
                <span className="bg-amethyst-500/30 text-amethyst-50 grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums">
                  {itemCount}
                </span>
                <span className="hidden text-sm sm:inline">
                  {t("quoteWizard.cartSummary", {
                    items: itemCount,
                    lines: lines.length,
                  })}
                </span>
              </span>
              <button
                type="button"
                onClick={next}
                className="btn-amethyst shrink-0 rounded-full px-6 py-3 text-sm font-semibold tracking-[2px] uppercase"
              >
                {t("quoteWizard.next")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -- Panel de opciones (variantes) */}
      {modalService && modalService.variants && (
        <GlassModal
          open
          onClose={() => setModalSlug(null)}
          title={modalService.name}
        >
          <p className="text-silver-300 -mt-2 text-sm">
            {t("quoteWizard.modalVariantSubtitle")}
          </p>

          <div className="mt-5 flex max-h-[55svh] flex-col gap-3 overflow-y-auto">
            {variantsCotizables(modalService).map((v) => {
                const key = keyOf(modalService.slug, v.id);
                const qty = cart[key] ?? 0;
                const contable = variantEsContable(v);
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
                          onClick={() =>
                            modalService.singleChoice
                              ? selectExclusive(modalService, key, 1)
                              : setQty(key, 1)
                          }
                          className="btn-outline shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
                        >
                          {t("quoteWizard.variantAdd")}
                        </button>
                      ) : contable ? (
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
                      ) : (
                        <button
                          type="button"
                          onClick={() => setQty(key, 0)}
                          className="border-amethyst-300/50 bg-amethyst-500/10 text-amethyst-200 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition hover:text-white"
                        >
                          <CheckIcon className="size-4" />
                          {t("quoteWizard.variantSelected")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          <button
            type="button"
            onClick={() => setModalSlug(null)}
            className="btn-amethyst mt-6 w-full rounded-full px-6 py-3 text-sm font-semibold tracking-[2px] uppercase"
          >
            {t("quoteWizard.modalDone")}
          </button>
        </GlassModal>
      )}
    </>
  );
}
