"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import type { PagoWompi, WompiMetodo } from "@only-g/shared-types/wompi";
import {
  formatearNumero,
  marcaDeTarjeta,
  type MarcaTarjeta,
} from "@only-g/shared-types/tarjeta";
import {
  CheckIcon,
  ClockIcon,
  CloseIcon,
  CreditCardIcon,
  SmartphoneIcon,
  SpinnerIcon,
  ShieldCheckIcon,
  ZapIcon,
} from "@/components/icons";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import { Alert } from "@/components/ui/Alert";
import { formatCOP } from "@only-g/shared-types/service";
import {
  crearPago,
  escucharPago,
  listarBancosPse,
  tokenizarTarjeta,
  wompiDisponible,
  type BancoPse,
} from "../lib/wompi-repo";

/**
 * Checkout de Wompi (§09 del OGM.pen).
 *
 * TRES PASOS, como el `Progress` de tres segmentos del mockup:
 *   1. RESUMEN  — qué se paga y cuánto, antes de pedir un solo dato.
 *   2. MÉTODO   — pestañas (tarjeta · PSE · Nequi) y el formulario de cada uno.
 *   3. ESTADO   — aprobada, pendiente o rechazada, con su comprobante.
 *
 * El estado del paso 3 NO lo decide este componente: se suscribe a
 * `wompiPagos/{reference}`, que solo escribe el webhook. Por eso Nequi funciona
 * sin que el usuario refresque: aprueba en su móvil y la pantalla cambia sola.
 *
 * RESPONSIVE: en escritorio es una tarjeta centrada; en móvil, una hoja que sube
 * desde abajo con su asa — las dos formas que dibuja el .pen. No es decoración:
 * en un móvil, un modal centrado deja el teclado tapando el formulario.
 */

/**
 * Métodos del checkout. Los que son MARCA se pintan con su logo oficial
 * (`public/logo/pagos/`): un usuario reconoce el rombo de Nequi mucho antes que
 * cualquier icono genérico de "móvil", y ver la marca de su banco es lo que le
 * da confianza para escribir sus datos. "Tarjeta" no es una marca, así que se
 * queda con icono — su marca real (Visa/Mastercard) aparece al teclear.
 */
const METODOS: {
  id: WompiMetodo;
  Icon?: typeof CreditCardIcon;
  logo?: string;
}[] = [
  { id: "CARD", Icon: CreditCardIcon },
  { id: "NEQUI", logo: "/logo/pagos/nequi.png" },
  { id: "PSE", logo: "/logo/pagos/pse.png" },
  { id: "BANCOLOMBIA_TRANSFER", logo: "/logo/pagos/bancolombia.png" },
];

/**
 * Logos de marca de tarjeta. Solo están los que tenemos en oficial: Amex y
 * Diners se detectan igual (y recortan bien el número), pero sin logo — mejor
 * ninguno que uno dibujado a ojo.
 */
const LOGO_MARCA: Partial<Record<NonNullable<MarcaTarjeta>, string>> = {
  visa: "/logo/pagos/visa.png",
  mastercard: "/logo/pagos/mastercard.svg",
};

/** Minutos que Nequi deja para aprobar desde la app antes de expirar. */
const NEQUI_MINUTOS = 15;

export function WompiCheckout({
  open,
  onClose,
  conversationId,
  monto,
  concepto,
  referenciaInicial,
}: {
  open: boolean;
  onClose: () => void;
  /** Chat de pago que da contexto. El importe real lo pone el servidor. */
  conversationId: string;
  /** Importe en COP, solo para MOSTRARLO. */
  monto: number;
  /** Qué se está comprando ("Perfil Premium", "Pase Golden"…). */
  concepto: string;
  /**
   * Referencia de un pago ya abierto. La usa la vuelta de PSE: el banco
   * devuelve al navegador con `?pago=…` y el checkout reabre directamente en el
   * paso 3, escuchando ese pago en vez de empezar de cero.
   */
  referenciaInicial?: string;
}) {
  const t = useTranslations("checkout");
  const reduce = useReducedMotion();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const [paso, setPaso] = useState<1 | 2 | 3>(referenciaInicial ? 3 : 1);
  const [metodo, setMetodo] = useState<WompiMetodo>("CARD");
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(
    referenciaInicial ?? null,
  );
  const [pago, setPago] = useState<PagoWompi | null>(null);
  /** No se puede LEER el pago (reglas sin desplegar, sesión caída). */
  const [sinLectura, setSinLectura] = useState(false);

  // Datos de cada método. Se guardan por separado para que cambiar de pestaña
  // no borre lo ya escrito (el mockup deja volver entre métodos).
  const [card, setCard] = useState({
    numero: "",
    vence: "",
    cvc: "",
    titular: "",
    cuotas: 1,
  });
  const [pse, setPse] = useState({
    tipo: 0,
    banco: "",
    docTipo: "CC",
    doc: "",
    correo: "",
  });
  const [nequi, setNequi] = useState("");
  const [bancos, setBancos] = useState<BancoPse[]>([]);

  // Los bancos de PSE los sirve Wompi y cambian: se piden al abrir esa pestaña,
  // no al montar, para no gastar una petición en quien paga con tarjeta.
  useEffect(() => {
    if (metodo !== "PSE" || bancos.length > 0) return;
    void listarBancosPse().then(setBancos);
  }, [metodo, bancos.length]);

  // Suscripción al pago: la ÚNICA fuente del estado que se pinta en el paso 3.
  useEffect(() => {
    if (!reference) return;
    setSinLectura(false);
    return escucharPago(reference, setPago, () => setSinLectura(true));
  }, [reference]);

  // Esc y bloqueo del scroll del fondo, como el resto de modales de la app.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const montoFmt = useMemo(() => formatCOP(monto), [monto]);

  const pagar = useCallback(async () => {
    if (!acepto) {
      setError(t("errors.acepto"));
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      let extra: Record<string, unknown> = {};
      if (metodo === "CARD") {
        if (!wompiDisponible()) throw new Error("noDisponible");
        const [mes, anio] = card.vence.split("/").map((s) => s.trim());
        if (!card.numero || !card.cvc || !mes || !anio || !card.titular) {
          throw new Error("campos");
        }
        const token = await tokenizarTarjeta({
          numero: card.numero,
          cvc: card.cvc,
          mes,
          anio,
          titular: card.titular,
        });
        extra = { cardToken: token, installments: card.cuotas };
      } else if (metodo === "NEQUI") {
        if (nequi.replace(/\D/g, "").length < 10) throw new Error("campos");
        extra = { nequiPhone: nequi.replace(/\D/g, "") };
      } else {
        if (!pse.banco || !pse.doc || !pse.correo) throw new Error("campos");
        extra = {
          pseUserType: pse.tipo,
          pseLegalIdType: pse.docTipo,
          pseLegalId: pse.doc,
          pseBank: pse.banco,
        };
      }

      // La vuelta de PSE entra por aquí: el banco devuelve a esta misma URL con
      // la referencia, y el checkout se reabre ya en el paso del estado.
      const url = new URL(window.location.href);
      url.searchParams.set("pago", "PENDIENTE");
      const creado = await crearPago({
        conversationId,
        metodo,
        redirectUrl: url.toString(),
        ...extra,
      });

      setReference(creado.reference);
      setPaso(3);
      // Salir del sitio SOLO cuando el método lo exige (PSE y Bancolombia van al
      // portal del banco). Con tarjeta y Nequi el usuario se queda aquí viendo
      // cómo cambia el estado; navegar recargaría la página y cerraría esto.
      const salirAlBanco =
        metodo === "PSE" || metodo === "BANCOLOMBIA_TRANSFER";
      if (salirAlBanco && creado.redirectUrl) {
        window.location.href = creado.redirectUrl;
      }
    } catch (e) {
      const clave = e instanceof Error ? e.message.split(":")[0] : "";
      setError(
        clave === "campos"
          ? t("errors.campos")
          : clave === "noDisponible"
            ? t("errors.noDisponible")
            : clave === "tarjeta-rechazada"
              ? t("errors.tarjeta")
              : t("errors.crear"),
      );
    } finally {
      setEnviando(false);
    }
  }, [acepto, metodo, card, nequi, pse, conversationId, t]);

  if (!montado) return null;

  const estado = pago?.estado ?? "pendiente";
  // Nequi en espera: transacción abierta, aún sin respuesta y sin haber salido
  // del sitio. Es la pantalla del ring y el temporizador del mockup.
  const esperandoNequi =
    paso === 3 && metodo === "NEQUI" && estado === "pendiente";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-90 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("title")}
            className="bg-ink-soft relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:max-w-lg sm:rounded-3xl"
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }
            }
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Asa: solo móvil. En escritorio no hay gesto que sugerir. */}
            <div className="flex justify-center pt-2.5 sm:hidden">
              <span className="h-1 w-10 rounded-full bg-white/25" />
            </div>

            <header className="flex items-center justify-between px-6 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheckIcon className="text-amethyst-300 size-5" />
                <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
                  {t("title")}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:text-white"
              >
                <CloseIcon className="size-4" />
              </button>
            </header>

            <Progreso paso={paso} label={t("paso", { n: paso })} />

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-6">
              {paso === 1 && (
                <PasoResumen
                  concepto={concepto}
                  montoFmt={montoFmt}
                  onContinuar={() => setPaso(2)}
                />
              )}

              {paso === 2 && (
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="text-silver-300 mb-2.5 text-sm font-medium">
                      {t("metodo.label")}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {METODOS.map(({ id, Icon, logo }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setMetodo(id)}
                          aria-pressed={metodo === id}
                          aria-label={t(`metodo.${id}`)}
                          className={`flex min-h-13 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[10px] font-semibold tracking-[1px] uppercase transition ${
                            metodo === id
                              ? "border-amethyst-300/60 bg-amethyst-500/15 text-amethyst-100"
                              : "text-silver-400 border-white/10 bg-white/[0.03] hover:border-white/25"
                          }`}
                        >
                          {logo ? (
                            // Los logos de marca vienen sobre fondo claro; en
                            // oscuro se dejan tal cual (son de color) y solo se
                            // atenúan cuando el método no está elegido.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={logo}
                              alt=""
                              aria-hidden="true"
                              className={`h-5 w-auto max-w-16 object-contain transition ${
                                metodo === id ? "" : "opacity-60 grayscale"
                              }`}
                            />
                          ) : (
                            Icon && <Icon className="size-5" />
                          )}
                          {t(`metodo.${id}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {metodo === "CARD" && (
                    <FormTarjeta value={card} onChange={setCard} />
                  )}
                  {metodo === "PSE" && (
                    <FormPse value={pse} onChange={setPse} bancos={bancos} />
                  )}
                  {metodo === "NEQUI" && (
                    <FormNequi value={nequi} onChange={setNequi} />
                  )}
                  {/* Bancolombia no pide datos: se autoriza en su portal. */}
                  {metodo === "BANCOLOMBIA_TRANSFER" && (
                    <p className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-3 text-xs leading-relaxed text-amber-100">
                      {t("bancolombia.info")}
                    </p>
                  )}

                  <BrebBanner />

                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acepto}
                      onChange={(e) => setAcepto(e.target.checked)}
                      className="accent-amethyst-500 mt-0.5 size-5 shrink-0 cursor-pointer"
                    />
                    <span className="text-silver-400 text-xs leading-relaxed">
                      {t.rich("acepto", {
                        terms: (c) => <span className="text-silver-200">{c}</span>,
                        privacy: (c) => (
                          <span className="text-silver-200">{c}</span>
                        ),
                      })}
                    </span>
                  </label>

                  {error && <Alert>{error}</Alert>}

                  <div>
                    <button
                      type="button"
                      onClick={pagar}
                      disabled={enviando}
                      className="btn-amethyst flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold tracking-[2px] uppercase disabled:opacity-60"
                    >
                      {enviando ? (
                        <>
                          <SpinnerIcon className="size-4 animate-spin" />
                          {t("procesando")}
                        </>
                      ) : (
                        t("pagar", { monto: montoFmt })
                      )}
                    </button>
                    <p className="text-silver-500 mt-2.5 flex items-center justify-center gap-1.5 text-[11px]">
                      <ShieldCheckIcon className="size-3.5" />
                      {t("seguro")}
                    </p>
                  </div>
                </div>
              )}

              {paso === 3 &&
                (esperandoNequi ? (
                  <EsperandoNequi
                    montoFmt={montoFmt}
                    onCancelar={() => {
                      setPaso(2);
                      setReference(null);
                      setPago(null);
                    }}
                  />
                ) : (
                  <PasoEstado
                    pago={pago}
                    sinLectura={sinLectura}
                    montoFmt={montoFmt}
                    concepto={concepto}
                    onCerrar={onClose}
                    onReintentar={() => {
                      setPaso(2);
                      setReference(null);
                      setPago(null);
                      setError(null);
                    }}
                  />
                ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Los tres segmentos del mockup. Anunciado a lectores como "paso N de 3". */
function Progreso({ paso, label }: { paso: number; label: string }) {
  return (
    <div
      className="flex gap-1.5 px-6"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={paso}
      aria-label={label}
    >
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-1 flex-1 rounded-full transition-colors ${
            n <= paso ? "bg-amethyst-500" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

function PasoResumen({
  concepto,
  montoFmt,
  onContinuar,
}: {
  concepto: string;
  montoFmt: string;
  onContinuar: () => void;
}) {
  const t = useTranslations("checkout");
  return (
    <div className="flex flex-col gap-5">
      <p className="text-silver-300 text-sm">{t("resumen.title")}</p>
      <div className="border-amethyst-300/25 from-amethyst-900/60 to-ink-panel flex items-center gap-4 rounded-2xl border bg-linear-to-br p-5">
        <span className="border-amethyst-300/40 bg-amethyst-500/20 text-amethyst-200 grid size-12 shrink-0 place-items-center rounded-xl border">
          <ShieldCheckIcon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-narrow truncate text-lg font-bold tracking-wide text-white">
            {concepto}
          </p>
          <p className="text-silver-400 text-xs">{t("resumen.total")}</p>
        </div>
        <p className="font-narrow shrink-0 text-2xl font-bold text-white">
          {montoFmt}
        </p>
      </div>
      <button
        type="button"
        onClick={onContinuar}
        className="btn-amethyst flex min-h-13 w-full items-center justify-center rounded-2xl text-sm font-bold tracking-[2px] uppercase"
      >
        {t("resumen.continuar")}
      </button>
    </div>
  );
}

/** Campo de texto del checkout. Fuente ≥16px: por debajo, iOS hace zoom al foco. */
function Campo({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  maxLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "text" | "email" | "tel";
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-silver-400 text-xs font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className="focus:border-amethyst-300/60 min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white placeholder:text-white/25 focus:outline-none"
      />
    </label>
  );
}

function FormTarjeta({
  value,
  onChange,
}: {
  value: { numero: string; vence: string; cvc: string; titular: string; cuotas: number };
  onChange: (v: typeof value) => void;
}) {
  const t = useTranslations("checkout.card");
  const marca = marcaDeTarjeta(value.numero);
  return (
    <div className="flex flex-col gap-3.5">
      {/* Número + marca. El logo aparece en cuanto los primeros dígitos la
          delatan (con Visa, al PRIMER carácter): confirma al usuario que
          reconocimos su tarjeta antes de que termine de escribirla, y es lo que
          hace que un formulario de pago se sienta de fiar. */}
      <div className="relative">
        <Campo
          label={t("numero")}
          placeholder={t("numeroPlaceholder")}
          value={value.numero}
          inputMode="numeric"
          maxLength={23}
          autoComplete="cc-number"
          onChange={(v) => onChange({ ...value, numero: formatearNumero(v) })}
        />
        {marca && LOGO_MARCA[marca] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={LOGO_MARCA[marca]}
            alt={marca}
            className="pointer-events-none absolute right-3 bottom-3 h-5 w-auto max-w-11 object-contain"
          />
        )}
      </div>
      <div className="flex gap-3">
        <Campo
          label={t("vence")}
          placeholder={t("vencePlaceholder")}
          value={value.vence}
          inputMode="numeric"
          maxLength={5}
          autoComplete="cc-exp"
          onChange={(v) => {
            const d = v.replace(/\D/g, "").slice(0, 4);
            onChange({
              ...value,
              vence: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d,
            });
          }}
        />
        <Campo
          label={t("cvc")}
          placeholder="123"
          value={value.cvc}
          inputMode="numeric"
          maxLength={4}
          autoComplete="cc-csc"
          onChange={(v) => onChange({ ...value, cvc: v.replace(/\D/g, "") })}
        />
      </div>
      <Campo
        label={t("titular")}
        placeholder={t("titularPlaceholder")}
        value={value.titular}
        autoComplete="cc-name"
        onChange={(v) => onChange({ ...value, titular: v })}
      />
    </div>
  );
}

function FormPse({
  value,
  onChange,
  bancos,
}: {
  value: { tipo: number; banco: string; docTipo: string; doc: string; correo: string };
  onChange: (v: typeof value) => void;
  bancos: BancoPse[];
}) {
  const t = useTranslations("checkout.pse");
  const select =
    "focus:border-amethyst-300/60 min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white focus:outline-none";
  return (
    <div className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-silver-400 text-xs font-medium">{t("tipo")}</span>
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: 0, label: t("natural") },
            { v: 1, label: t("juridica") },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange({ ...value, tipo: o.v })}
              aria-pressed={value.tipo === o.v}
              className={`min-h-12 rounded-xl border text-sm font-semibold transition ${
                value.tipo === o.v
                  ? "border-amethyst-300/60 bg-amethyst-500/15 text-white"
                  : "text-silver-400 border-white/10 bg-white/[0.03]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-silver-400 text-xs font-medium">{t("banco")}</span>
        <select
          value={value.banco}
          onChange={(e) => onChange({ ...value, banco: e.target.value })}
          className={select}
        >
          <option value="">{t("bancoPlaceholder")}</option>
          {bancos.map((b) => (
            <option
              key={b.financial_institution_code}
              value={b.financial_institution_code}
            >
              {b.financial_institution_name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <label className="flex w-28 shrink-0 flex-col gap-1.5">
          <span className="text-silver-400 text-xs font-medium">
            {t("documento")}
          </span>
          <select
            value={value.docTipo}
            onChange={(e) => onChange({ ...value, docTipo: e.target.value })}
            className={select}
          >
            {["CC", "CE", "NIT", "PP"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <Campo
          label={t("numeroDocumento")}
          value={value.doc}
          inputMode="numeric"
          onChange={(v) => onChange({ ...value, doc: v.replace(/\D/g, "") })}
        />
      </div>
      <Campo
        label={t("correo")}
        value={value.correo}
        inputMode="email"
        autoComplete="email"
        onChange={(v) => onChange({ ...value, correo: v })}
      />
      <p className="rounded-xl border border-sky-400/25 bg-sky-400/[0.06] px-3.5 py-3 text-xs leading-relaxed text-sky-200">
        {t("nota")}
      </p>
    </div>
  );
}

function FormNequi({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("checkout.nequi");
  return (
    <div className="flex flex-col gap-3.5">
      <Campo
        label={t("numero")}
        placeholder={t("numeroPlaceholder")}
        value={value}
        inputMode="tel"
        maxLength={12}
        autoComplete="tel-national"
        onChange={(v) => onChange(v.replace(/\D/g, "").slice(0, 10))}
      />
      <p className="rounded-xl border border-pink-400/25 bg-pink-500/[0.07] px-3.5 py-3 text-xs leading-relaxed text-pink-200">
        {t("info")}
      </p>
    </div>
  );
}

/** El atajo Bre-B del mockup. Informativo: la llave se usa desde el banco. */
function BrebBanner() {
  const t = useTranslations("checkout.breb");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-pink-400/25 bg-pink-500/[0.05] px-3.5 py-3">
      <ZapIcon className="size-4 shrink-0 text-pink-300" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-pink-100">{t("title")}</p>
        <p className="text-silver-400 text-xs">{t("sub")}</p>
      </div>
    </div>
  );
}

/**
 * Espera de Nequi. El temporizador no controla nada —quien decide es el
 * webhook— pero sin él la pantalla parece colgada y la gente cierra la pestaña
 * justo antes de aprobar.
 */
function EsperandoNequi({
  montoFmt,
  onCancelar,
}: {
  montoFmt: string;
  onCancelar: () => void;
}) {
  const t = useTranslations("checkout.nequi");
  const [restan, setRestan] = useState(NEQUI_MINUTOS * 60);

  useEffect(() => {
    const id = setInterval(() => setRestan((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(restan / 60)).padStart(2, "0");
  const ss = String(restan % 60).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <span className="grid size-24 place-items-center rounded-full border-2 border-pink-400/45 bg-pink-500/10">
        <SmartphoneIcon className="size-10 text-pink-300" />
      </span>
      <div>
        <h3 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase">
          {t("esperandoTitle")}
        </h3>
        <p className="text-silver-400 mt-2 text-sm leading-relaxed">
          {t("esperandoSub", { monto: montoFmt })}
        </p>
      </div>
      <span className="text-silver-300 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold tabular-nums">
        <ClockIcon className="size-3.5" />
        {restan > 0 ? t("expira", { tiempo: `${mm}:${ss}` }) : t("expirado")}
      </span>
      <span className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full bg-pink-300/70"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </span>
      <button
        type="button"
        onClick={onCancelar}
        className="text-silver-400 min-h-11 w-full rounded-xl border border-white/12 bg-white/[0.04] text-xs font-semibold tracking-[1px] uppercase transition hover:text-white"
      >
        {t("cancelar")}
      </button>
    </div>
  );
}

/** Las tres tarjetas finales del mockup, con su comprobante. */
function PasoEstado({
  pago,
  sinLectura,
  montoFmt,
  concepto,
  onCerrar,
  onReintentar,
}: {
  pago: PagoWompi | null;
  /** No se pudo LEER el pago: distinto de "está pendiente". */
  sinLectura: boolean;
  montoFmt: string;
  concepto: string;
  onCerrar: () => void;
  onReintentar: () => void;
}) {
  const t = useTranslations("checkout");
  const estado = pago?.estado ?? "pendiente";

  const tono = {
    aprobado: {
      anillo: "border-success/35 bg-success/10 text-success",
      Icon: CheckIcon,
      title: t("estado.aprobadaTitle"),
      sub: t("estado.aprobadaSub"),
    },
    pendiente: {
      anillo: "border-warning/35 bg-warning/10 text-warning",
      Icon: ClockIcon,
      title: t("estado.pendienteTitle"),
      sub: t("estado.pendienteSub"),
    },
    rechazado: {
      anillo: "border-danger/35 bg-danger/10 text-danger",
      Icon: CloseIcon,
      title: t("estado.rechazadaTitle"),
      sub: t("estado.rechazadaSub"),
    },
  }[estado];

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span
        className={`grid size-20 place-items-center rounded-full border-2 ${tono.anillo}`}
      >
        <tono.Icon className="size-9" />
      </span>
      <div>
        <h3 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase">
          {tono.title}
        </h3>
        <p className="text-silver-400 mt-2 text-sm leading-relaxed">
          {tono.sub}
        </p>
      </div>

      {/* Un fallo de lectura NO se disfraza de "pendiente": si no podemos ver el
          pago, se dice, porque el dinero pudo salir igualmente. */}
      {sinLectura && <Alert tone="warning">{t("errors.sinLectura")}</Alert>}

      {/* Comprobante: los datos con los que el usuario puede reclamar. */}
      <div className="bg-ink w-full overflow-hidden rounded-2xl border border-white/10 text-left">
        <p className="border-b border-white/[0.08] px-5 py-3 text-[11px] font-bold tracking-[2px] text-white/60 uppercase">
          {t("recibo.title")}
        </p>
        <dl className="divide-y divide-white/[0.06]">
          <FilaRecibo label={t("recibo.concepto")} value={concepto} />
          <FilaRecibo
            label={t("recibo.referencia")}
            value={pago?.reference ?? "—"}
          />
          <FilaRecibo label={t("recibo.metodo")} value={pago?.metodo ?? "—"} />
          <FilaRecibo
            label={t("recibo.fecha")}
            value={
              pago?.createdAt
                ? new Date(pago.createdAt).toLocaleString()
                : "—"
            }
          />
          <FilaRecibo label={t("recibo.total")} value={montoFmt} />
        </dl>
      </div>

      {estado === "rechazado" ? (
        <button
          type="button"
          onClick={onReintentar}
          className="btn-amethyst flex min-h-13 w-full items-center justify-center rounded-2xl text-sm font-bold tracking-[2px] uppercase"
        >
          {t("estado.reintentar")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onCerrar}
          className={`flex min-h-13 w-full items-center justify-center rounded-2xl text-sm font-bold tracking-[2px] uppercase transition ${
            estado === "aprobado"
              ? "bg-success text-ink"
              : `${glassSurfaceSoft} text-white`
          }`}
        >
          {estado === "aprobado" ? (
            t("estado.listo")
          ) : (
            <>
              <GlassSheen />
              <span className="relative">{t("estado.entendido")}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

function FilaRecibo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-silver-500 shrink-0 text-xs">{label}</dt>
      <dd className="truncate text-xs font-semibold text-white">{value}</dd>
    </div>
  );
}
