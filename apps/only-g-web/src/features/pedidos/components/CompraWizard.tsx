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
  type PricingModel,
} from "@only-g/shared-types/service";
import {
  lineaTipoDe,
  subtotalLinea,
  totalPedido,
  tieneSesion,
  type LineaTipo,
} from "@only-g/shared-types/pedido";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MinusIcon, PlusIcon, CheckIcon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { GlassModal } from "@/components/ui/GlassModal";
import { glassSurface, glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import {
  ServiceCard,
  ServiceCheckBadge,
} from "@/features/services/components/ServiceCard";
import {
  SessionSlotPicker,
  type SessionSlotValue,
} from "@/features/booking/components/SessionSlotPicker";
import { createPedido, type PedidoLineaInput } from "../lib/pedidos-repo";
import { track } from "@/lib/firebase/analytics";
import type { Sede, SedeId } from "@only-g/shared-types/sede";
import { sedes as seedSedes } from "@/features/sedes/data/sedes";
import { getAllSedes } from "@/features/sedes/lib/sedes-repo";

// Catálogo COMPRABLE (precio fijo, un solo pago): servicios sin variantes que
// no son "a cotizar", o servicios con variantes que tienen AL MENOS una
// variante comprable (p. ej. renta-estudio: "horas"/"dia" sí, "varios-dias"
// no). Filtro a nivel de módulo — no depende de props/estado.
const PURCHASABLE = services.filter((s) =>
  hasVariants(s) ? (s.variants ?? []).some((v) => !isQuoteOnly(v)) : !isQuoteOnly(s),
);

const keyOf = (slug: string, variantId?: string) =>
  variantId ? `${slug}::${variantId}` : slug;

type StepKey = "cart" | "agenda" | "contact";

const INPUT =
  "w-full rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80";
const LABEL = "flex flex-col gap-1.5 text-left";
const LABEL_TEXT = "text-xs uppercase tracking-[2px] text-silver-300";
const STEPPER = `${glassSurfaceSoft} flex size-10 items-center justify-center rounded-full text-silver-100 transition hover:text-white hover:ring-amethyst-300/70`;
const VENUE_BTN =
  "rounded-lg border px-4 py-3 text-left transition";

type Line = {
  key: string;
  service: Service;
  variant?: ServiceVariant;
  qty: number;
  tipo: LineaTipo;
  pricing: PricingModel;
  precioUnitario: number;
  subtotal: number;
};

export function CompraWizard() {
  const t = useTranslations();
  const reduce = useReducedMotion();
  const params = useSearchParams();
  const { user, account } = useAuth();

  const initialService = (() => {
    const slug = params.get("servicio");
    return slug ? PURCHASABLE.find((s) => s.slug === slug) : undefined;
  })();

  const [stepKey, setStepKey] = useState<StepKey>("cart");
  const [cart, setCart] = useState<Record<string, number>>(() =>
    initialService && !hasVariants(initialService)
      ? { [initialService.slug]: 1 }
      : {},
  );
  const [modalSlug, setModalSlug] = useState<string | null>(
    initialService && hasVariants(initialService) ? initialService.slug : null,
  );

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

  const [sessionPicks, setSessionPicks] = useState<
    Record<string, SessionSlotValue | null>
  >({});

  const [contactName, setContactName] = useState(
    account?.displayName ?? user?.displayName ?? "",
  );
  const [contactEmail, setContactEmail] = useState(
    account?.email ?? user?.email ?? "",
  );
  // Se captura para el futuro chat de pago del pedido; `CreatePedidoInput`
  // (pedidos-repo) todavía no admite teléfono, así que por ahora no se envía.
  const [contactPhone, setContactPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  const lines: Line[] = [];
  for (const [key, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const [slug, variantId] = key.split("::");
    const service = PURCHASABLE.find((s) => s.slug === slug);
    if (!service) continue;
    const variant = variantId
      ? service.variants?.find((v) => v.id === variantId && !isQuoteOnly(v))
      : undefined;
    if (variantId && !variant) continue;
    const p = variant ?? service;
    if (isQuoteOnly(p)) continue;
    const precioUnitario = p.basePrice ?? 0;
    lines.push({
      key,
      service,
      variant,
      qty,
      tipo: lineaTipoDe(p.pricing),
      pricing: p.pricing,
      precioUnitario,
      subtotal: subtotalLinea(precioUnitario, qty),
    });
  }

  const total = totalPedido(lines);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const hasSesion = tieneSesion(lines);
  const sessionLines = lines.filter((l) => l.tipo === "sesion");
  const allSlotsReady = sessionLines.every((l) => sessionPicks[l.key]);

  const steps: StepKey[] = [
    "cart",
    ...(hasSesion ? (["agenda"] as const) : []),
    "contact",
  ];
  const stepIdx = Math.max(0, steps.indexOf(stepKey));
  const STEP_LABELS: Record<StepKey, string> = {
    cart: t("compraWizard.stepOrder"),
    agenda: t("compraWizard.stepAgenda"),
    contact: t("compraWizard.stepContact"),
  };

  const modalService = modalSlug
    ? (PURCHASABLE.find((s) => s.slug === modalSlug) ?? null)
    : null;
  const modalVariants = (modalService?.variants ?? []).filter(
    (v) => !isQuoteOnly(v),
  );

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

  /** Slots (HH:mm) por fecha ya elegidos por OTRAS líneas de sesión del mismo
   *  pedido — se pasan al picker de `excludeKey` para que no se pisen entre sí. */
  function blockedFor(excludeKey: string): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [k, pick] of Object.entries(sessionPicks)) {
      if (k === excludeKey || !pick) continue;
      out[pick.date] = [...(out[pick.date] ?? []), ...pick.slots];
    }
    return out;
  }

  function next() {
    setError(null);
    if (stepKey === "cart" && lines.length === 0) {
      setError(t("compraWizard.errorEmptyCart"));
      return;
    }
    if (stepKey === "agenda" && !allSlotsReady) {
      setError(t("compraWizard.errorMissingSlot"));
      return;
    }
    setStepKey(steps[Math.min(steps.length - 1, stepIdx + 1)]);
  }

  function back() {
    setError(null);
    setStepKey(steps[Math.max(0, stepIdx - 1)]);
  }

  async function submit() {
    setError(null);
    if (!contactName.trim() || !contactEmail.trim()) {
      setError(t("compraWizard.errorMissingContact"));
      return;
    }
    if (!sede) {
      setError(t("compraWizard.errorMissingVenue"));
      return;
    }
    if (!user) {
      setError(t("compraWizard.errorSessionExpired"));
      return;
    }
    setBusy(true);
    try {
      const lineas: PedidoLineaInput[] = lines.map((l) => {
        const input: PedidoLineaInput = {
          serviceSlug: l.service.slug,
          serviceName: l.variant
            ? `${l.service.name} — ${l.variant.name}`
            : l.service.name,
          tipo: l.tipo,
          pricing: l.pricing,
          cantidad: l.qty,
          precioUnitario: l.precioUnitario,
          subtotal: l.subtotal,
        };
        if (l.variant) input.variantId = l.variant.id;
        const pick = sessionPicks[l.key];
        if (l.tipo === "sesion" && pick) {
          input.start = pick.start;
          input.durationMin = pick.durationMin;
          input.slotCtx = { mes: pick.mes, date: pick.date, slots: pick.slots };
        }
        return input;
      });

      const id = await createPedido({
        uid: user.uid,
        sede,
        clientName: contactName.trim(),
        clientEmail: contactEmail.trim(),
        lineas,
        total,
      });
      track("pedido_submitted");
      setDoneId(id);
    } catch (e) {
      const taken = e instanceof Error && e.message === "SLOT_TAKEN";
      setError(
        t(taken ? "compraWizard.errorSlotTaken" : "compraWizard.errorSubmit"),
      );
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
          {t("compraWizard.successHeading")}
        </h1>
        <p className="text-silver-300 mt-3">
          {t("compraWizard.successBody", { itemCount })}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/solicitudes/pedido/${doneId}`}
            className="btn-amethyst rounded-full px-8 py-3 text-sm font-semibold tracking-[2px] uppercase"
          >
            {t("compraWizard.viewOrder")}
          </Link>
          <Link
            href="/"
            className="btn-outline rounded-full px-8 py-3 text-sm tracking-[2px] uppercase"
          >
            {t("compraWizard.goHome")}
          </Link>
        </div>
      </main>
    );
  }

  const isLastStep = stepIdx === steps.length - 1;

  return (
    <>
      <main className="mx-auto min-h-dvh max-w-2xl px-6 pt-28 pb-32 sm:px-12">
        <header className="mb-8">
          <p className="text-amethyst-300 text-sm tracking-[4px] uppercase">
            {t("compraWizard.eyebrow")}
          </p>
          <h1 className="font-narrow mt-3 text-4xl font-bold uppercase sm:text-6xl">
            {t("compraWizard.heading")}
          </h1>

          <div className="mt-6 flex items-center gap-2">
            {steps.map((key, i) => (
              <span
                key={key}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= stepIdx ? "bg-amethyst-300" : "bg-white/10"
                }`}
              />
            ))}
          </div>
          <p className="text-silver-400 mt-2 text-xs tracking-[2px] uppercase">
            {t("compraWizard.stepIndicator", {
              step: stepIdx + 1,
              total: steps.length,
              stepName: STEP_LABELS[stepKey],
            })}
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isLastStep) next();
            else submit();
          }}
          className="flex flex-col gap-5"
        >
          {/* -- Paso: carrito -- */}
          {stepKey === "cart" && (
            <div className="flex flex-col gap-4">
              <p className="text-silver-300">{t("compraWizard.step1Intro")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {PURCHASABLE.map((s) => {
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
                            ? t("compraWizard.variantCount", {
                                count: serviceLines.length,
                              })
                            : t("compraWizard.variantsCta")
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
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setQty(l.key, l.qty - 1)}
                                      className={STEPPER}
                                      aria-label={t(
                                        "compraWizard.ariaRemoveOne",
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
                                      aria-label={t("compraWizard.ariaAddOne")}
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
                                {t("compraWizard.changeOptions")}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setQty(s.slug, qty - 1)}
                                  className={STEPPER}
                                  aria-label={t("compraWizard.ariaRemoveOne")}
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
                                  aria-label={t("compraWizard.ariaAddOne")}
                                >
                                  <PlusIcon className="size-4" />
                                </button>
                                <span className="text-silver-400 ml-1 text-xs">
                                  {unitLabel(s)}
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-white">
                                {formatCOP((s.basePrice ?? 0) * qty)}
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
                    {t("compraWizard.cartSummary", {
                      items: itemCount,
                      lines: lines.length,
                    })}
                  </span>
                  <span className="font-semibold text-white">
                    {t("compraWizard.total")} {formatCOP(total)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* -- Paso: agenda (solo si hay línea de sesión) -- */}
          {stepKey === "agenda" && hasSesion && (
            <div className="flex flex-col gap-6">
              <p className="text-silver-300">{t("compraWizard.agendaIntro")}</p>

              <fieldset className={LABEL}>
                <span className={LABEL_TEXT}>
                  {t("compraWizard.labelVenue")}
                </span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sedes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSede(s.id)}
                      className={`${VENUE_BTN} ${
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

              {sessionLines.map((l) => (
                <div
                  key={l.key}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-narrow text-lg leading-tight font-bold text-white uppercase">
                        {l.variant
                          ? `${l.service.name} — ${l.variant.name}`
                          : l.service.name}
                      </p>
                      <p className="text-silver-400 mt-0.5 text-xs">
                        {t("compraWizard.sessionHoursNeeded", { hours: l.qty })}
                      </p>
                    </div>
                    {sessionPicks[l.key] && (
                      <span className="border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200 flex size-8 shrink-0 items-center justify-center rounded-full border">
                        <CheckIcon className="size-4" />
                      </span>
                    )}
                  </div>
                  <SessionSlotPicker
                    sede={sede}
                    requiredHours={l.qty}
                    blockedByOtherLines={blockedFor(l.key)}
                    onChange={(v) =>
                      setSessionPicks((p) => ({ ...p, [l.key]: v }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {/* -- Paso: contacto + confirmar -- */}
          {stepKey === "contact" && (
            <>
              {!hasSesion && (
                <fieldset className={LABEL}>
                  <span className={LABEL_TEXT}>
                    {t("compraWizard.labelVenue")}
                  </span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sedes.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSede(s.id)}
                        className={`${VENUE_BTN} ${
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
              )}

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-silver-400 text-xs tracking-[2px] uppercase">
                  {t("compraWizard.orderSummaryHeading")}
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {lines.map((l) => (
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
                        {formatCOP(l.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                  <span className="text-silver-300">
                    {t("compraWizard.totalToPay")}
                  </span>
                  <span className="font-semibold text-white">
                    {formatCOP(total)}
                  </span>
                </div>
              </div>

              <label className={LABEL}>
                <span className={LABEL_TEXT}>
                  {t("compraWizard.labelName")}
                </span>
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
                  {t("compraWizard.labelEmail")}
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
                  {t("compraWizard.labelPhone")}
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

          <div className="mt-2 flex items-center justify-between gap-3">
            {stepIdx > 0 ? (
              <button
                type="button"
                onClick={back}
                className="btn-outline rounded-full px-6 py-3 text-sm tracking-[2px] uppercase"
              >
                {t("compraWizard.back")}
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
                ? t("compraWizard.sending")
                : isLastStep
                  ? t("compraWizard.submit")
                  : t("compraWizard.next")}
            </button>
          </div>
        </form>
      </main>

      {/* -- Barra flotante para continuar (paso carrito) -- */}
      <AnimatePresence>
        {stepKey === "cart" && lines.length > 0 && (
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
                  {t("compraWizard.cartSummary", {
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
                {t("compraWizard.next")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -- Panel de opciones (variantes comprables) -- */}
      {modalService && modalVariants.length > 0 && (
        <GlassModal
          open
          onClose={() => setModalSlug(null)}
          title={modalService.name}
        >
          <p className="text-silver-300 -mt-2 text-sm">
            {t("compraWizard.modalVariantSubtitle")}
          </p>

          <div className="mt-5 flex max-h-[55svh] flex-col gap-3 overflow-y-auto">
            {modalVariants.map((v) => {
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
                        className="btn-outline shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
                      >
                        {t("compraWizard.variantAdd")}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQty(key, qty - 1)}
                          className={STEPPER}
                          aria-label={t("compraWizard.ariaRemoveOne")}
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
                          aria-label={t("compraWizard.ariaAddOne")}
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
            className="btn-amethyst mt-6 w-full rounded-full px-6 py-3 text-sm font-semibold tracking-[2px] uppercase"
          >
            {t("compraWizard.modalDone")}
          </button>
        </GlassModal>
      )}
    </>
  );
}
