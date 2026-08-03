"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import {
  COLECTIVO_DISCIPLINAS,
  COLECTIVO_TIPOS,
  CUPOS_MAXIMOS,
  CUPOS_MINIMOS,
  CUPOS_PRESETS,
  DEFAULT_ACCENT,
  inicialesColectivo,
  totalMembresia,
  type ColectivoDisciplina,
  type ColectivoTipo,
} from "@only-g/shared-types/colectivo";
import type { MetodoPago } from "@only-g/shared-types/payment-method";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { usePrecios } from "@/features/pricing/components/PreciosProvider";
import { PaymentMethodPicker } from "@/features/conversations/components/PaymentMethodPicker";
import { createPaymentConversation } from "@/features/conversations/lib/conversations-repo";
import { openConversation } from "@/features/conversations/lib/open-conversation";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import {
  ActivityIcon,
  ArrowLeftIcon,
  BuildingIcon,
  CameraIcon,
  CheckIcon,
  FlameIcon,
  GraduationCapIcon,
  MinusIcon,
  MusicIcon,
  PlusIcon,
  SpinnerIcon,
  UsersRoundIcon,
} from "@/components/icons";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import {
  createColectivo,
  slugDisponible,
  slugify,
} from "../lib/colectivos-repo";

/**
 * Alta de un colectivo (§07, frame `M2BMG`): tipo → identidad → membresía.
 *
 * El colectivo se crea VISIBLE de inmediato y la membresía queda pendiente de
 * pago. Es el mismo trato que el perfil de artista (borrador gratis, cobro al
 * publicar): quien funda algo quiere verlo existir antes de pagar, y el cobro
 * empuja donde de verdad importa — sin membresía activa el colectivo no puede
 * crecer, aunque siga en pie.
 */

const TIPO_ICON: Record<ColectivoTipo, typeof BuildingIcon> = {
  sello: BuildingIcon,
  movimiento: FlameIcon,
  agrupacion: UsersRoundIcon,
  academia: GraduationCapIcon,
};

const DISCIPLINA_ICON: Record<ColectivoDisciplina, typeof MusicIcon> = {
  musica: MusicIcon,
  modelaje: CameraIcon,
  baile: ActivityIcon,
  academia: GraduationCapIcon,
};

export function CrearColectivoWizard() {
  return (
    <RequireAuth>
      <Wizard />
    </RequireAuth>
  );
}

function Wizard() {
  const t = useTranslations("crearColectivo");
  const tc = useTranslations("colectivos");
  const reduce = useReducedMotion();
  const router = useRouter();
  const { user } = useAuth();
  const precios = usePrecios();

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<ColectivoTipo | null>(null);
  const [nombre, setNombre] = useState("");
  const [slugManual, setSlugManual] = useState<string | null>(null);
  const [disciplina, setDisciplina] = useState<ColectivoDisciplina>("musica");
  const [ciudad, setCiudad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [cupos, setCupos] = useState<number>(5);
  const [showPago, setShowPago] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El slug se deriva del nombre hasta que el usuario lo toca a mano.
  const slug = slugManual ?? slugify(nombre);
  const total = useMemo(
    () =>
      totalMembresia(cupos, {
        precioColectivo: precios.precioColectivo,
        precioCupoColectivo: precios.precioCupoColectivo,
      }),
    [cupos, precios],
  );

  const puedeSeguir2 = nombre.trim().length >= 2 && slug.length >= 2;

  async function crear(metodo: MetodoPago) {
    if (!user || !tipo || !puedeSeguir2) return;
    setShowPago(false);
    setCreando(true);
    setError(null);
    try {
      if (!(await slugDisponible(slug))) {
        setError(t("errors.slugTaken"));
        setPaso(2);
        return;
      }
      await createColectivo(slug, user.uid, {
        nombre: nombre.trim(),
        tipo,
        disciplina,
        descripcion: descripcion.trim() || undefined,
        ciudad: ciudad.trim() || undefined,
        accent,
        miembros: [],
        logoURL: undefined,
        coverURL: undefined,
        lanzamientos: undefined,
        generos: undefined,
        socials: undefined,
        location: undefined,
      });
      // El colectivo ya existe y se ve. Ahora se abre el chat de pago de su
      // membresía (mismo flujo manual que el premium del perfil).
      const id = await createPaymentConversation({
        uid: user.uid,
        concepto: "colectivo",
        ref: { kind: "colectivo", id: slug },
        metodo,
        monto: total,
      });
      openConversation(id);
      router.push(`/colectivos/${slug}`);
    } catch (e) {
      console.error("[colectivos] crear:", e);
      setError(t("errors.create"));
    } finally {
      setCreando(false);
    }
  }

  return (
    <main className="bg-ink min-h-dvh pb-28">
      <div className="mx-auto max-w-4xl px-6 pt-8">
        <button
          type="button"
          onClick={() => (paso === 1 ? router.back() : setPaso((p) => (p - 1) as 1 | 2))}
          className={`${glassSurfaceSoft} inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold tracking-[2px] text-white/90 uppercase transition hover:text-white`}
        >
          <GlassSheen />
          <ArrowLeftIcon className="relative size-4" />
          <span className="relative">{t("back")}</span>
        </button>

        <h1 className="font-narrow mt-8 text-4xl font-bold text-white uppercase sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-silver-400 mt-2 text-sm">{t("subtitle")}</p>

        {/* Pasos */}
        <ol className="mt-8 flex flex-wrap items-center gap-3">
          {[1, 2, 3].map((n) => (
            <li key={n} className="flex items-center gap-3">
              <span
                className={`font-narrow flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-[1px] uppercase transition ${
                  paso === n
                    ? "bg-amethyst-500/20 text-amethyst-100 ring-amethyst-300/50 ring-1 ring-inset"
                    : paso > n
                      ? "text-emerald-300"
                      : "text-silver-500"
                }`}
              >
                {paso > n ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  <span className="tabular-nums">{n}</span>
                )}
                {t(`step${n}`)}
              </span>
              {n < 3 && <span className="h-px w-6 bg-white/15" />}
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait">
          <motion.div
            key={paso}
            initial={reduce ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
            className="mt-8"
          >
            {paso === 1 && (
              <section>
                <h2 className="font-narrow text-xl font-bold text-white uppercase">
                  {t("s1.title")}
                </h2>
                <p className="text-silver-400 mt-1 text-sm">{t("s1.hint")}</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {COLECTIVO_TIPOS.map((v) => {
                    const Icon = TIPO_ICON[v];
                    const on = tipo === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setTipo(v);
                          setPaso(2);
                        }}
                        className={`rounded-2xl border p-5 text-left transition ${
                          on
                            ? "border-amethyst-300/60 bg-amethyst-500/10"
                            : "bg-ink-panel border-white/10 hover:border-white/30"
                        }`}
                      >
                        <Icon className="text-amethyst-300 size-6" />
                        <p className="font-narrow mt-3 text-base font-bold tracking-wide text-white uppercase">
                          {tc(`tipo.${v}`)}
                        </p>
                        <p className="text-silver-400 mt-1.5 text-xs leading-relaxed">
                          {t(`s1.desc.${v}`)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {paso === 2 && (
              <section className="flex flex-col gap-5">
                <div>
                  <h2 className="font-narrow text-xl font-bold text-white uppercase">
                    {t("s2.title")}
                  </h2>
                  <p className="text-silver-400 mt-1 text-sm">{t("s2.hint")}</p>
                </div>

                <Campo label={t("s2.name")}>
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder={t("s2.namePlaceholder")}
                    className="font-narrow w-full bg-transparent text-2xl font-bold text-white uppercase outline-none placeholder:text-white/25"
                  />
                </Campo>

                <Campo label={t("s2.url")} hint={t("s2.urlHint")}>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-silver-500 shrink-0">
                      /colectivos/
                    </span>
                    <input
                      value={slug}
                      onChange={(e) => setSlugManual(slugify(e.target.value))}
                      className="text-amethyst-200 w-full bg-transparent outline-none"
                    />
                  </div>
                </Campo>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Campo label={t("s2.discipline")}>
                    <div className="flex flex-wrap gap-2">
                      {COLECTIVO_DISCIPLINAS.map((d) => {
                        const Icon = DISCIPLINA_ICON[d];
                        const on = disciplina === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDisciplina(d)}
                            aria-pressed={on}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              on
                                ? "border-amethyst-300/60 bg-amethyst-500/10 text-amethyst-100"
                                : "text-silver-300 border-white/15 hover:border-white/35"
                            }`}
                          >
                            <Icon className="size-3.5" />
                            {tc(`disciplina.${d}`)}
                          </button>
                        );
                      })}
                    </div>
                  </Campo>

                  <Campo label={t("s2.city")}>
                    <input
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      placeholder={t("s2.cityPlaceholder")}
                      className="text-silver-100 w-full bg-transparent text-sm outline-none placeholder:text-white/25"
                    />
                  </Campo>
                </div>

                <Campo label={t("s2.description")}>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder={t("s2.descriptionPlaceholder")}
                    className="text-silver-100 min-h-24 w-full resize-y bg-transparent text-sm leading-relaxed outline-none placeholder:text-white/25"
                  />
                </Campo>

                <Campo label={t("s2.accent")}>
                  <div className="flex items-center gap-3">
                    <span
                      className="font-narrow grid size-12 place-items-center rounded-xl text-sm font-bold text-white"
                      style={{
                        backgroundImage: `linear-gradient(315deg, ${accent}, #1a1626)`,
                      }}
                    >
                      {inicialesColectivo(nombre || "?")}
                    </span>
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      aria-label={t("s2.accent")}
                      className="size-9 cursor-pointer rounded-lg border border-white/20 bg-transparent"
                    />
                  </div>
                </Campo>

                {error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  disabled={!puedeSeguir2}
                  onClick={() => setPaso(3)}
                  className="from-amethyst-400 to-amethyst-600 font-narrow mt-2 inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full bg-linear-to-b px-8 text-sm font-bold tracking-[2px] text-white uppercase transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("continue")}
                </button>
              </section>
            )}

            {paso === 3 && (
              <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="flex flex-col gap-5">
                  <div>
                    <h2 className="font-narrow text-xl font-bold text-white uppercase">
                      {t("s3.title")}
                    </h2>
                    <p className="text-silver-400 mt-1 text-sm leading-relaxed">
                      {t("s3.hint")}
                    </p>
                  </div>

                  <div className="bg-ink-panel rounded-[18px] border border-white/[0.08] p-5">
                    <p className="font-narrow text-silver-400 text-[11px] font-semibold tracking-[2px] uppercase">
                      {t("s3.slots")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {CUPOS_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCupos(p)}
                          aria-pressed={cupos === p}
                          className={`font-narrow min-w-16 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                            cupos === p
                              ? "border-amethyst-300/60 bg-amethyst-500/10 text-amethyst-100"
                              : "text-silver-300 border-white/15 hover:border-white/35"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3">
                      <span className="text-silver-300 text-sm">
                        {t("s3.slotsCount", { count: cupos })}
                      </span>
                      <span className="flex items-center gap-2">
                        <Paso
                          onClick={() =>
                            setCupos((c) => Math.max(CUPOS_MINIMOS, c - 1))
                          }
                          label={t("s3.less")}
                        >
                          <MinusIcon className="size-4" />
                        </Paso>
                        <span className="font-narrow w-10 text-center text-lg font-bold text-white tabular-nums">
                          {cupos}
                        </span>
                        <Paso
                          onClick={() =>
                            setCupos((c) => Math.min(CUPOS_MAXIMOS, c + 1))
                          }
                          label={t("s3.more")}
                        >
                          <PlusIcon className="size-4" />
                        </Paso>
                      </span>
                    </div>
                    <p className="text-silver-500 mt-3 text-xs leading-relaxed">
                      {t("s3.slotsNote")}
                    </p>
                  </div>
                </div>

                {/* Resumen y cobro */}
                <aside className="bg-amethyst-500/[0.05] border-amethyst-300/20 h-fit rounded-2xl border p-6">
                  <p className="font-narrow text-silver-400 text-[11px] font-semibold tracking-[2px] uppercase">
                    {t("s3.summary")}
                  </p>
                  <dl className="mt-4 flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-silver-300">{t("s3.planLine")}</dt>
                      <dd className="text-silver-100 tabular-nums">
                        {fmtCop(precios.precioColectivo)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-silver-300">
                        {t("s3.slotsLine", { count: cupos })}
                      </dt>
                      <dd className="text-silver-100 tabular-nums">
                        {fmtCop(cupos * precios.precioCupoColectivo)}
                      </dd>
                    </div>
                    <div className="bg-amethyst-300/20 h-px" />
                    <div className="flex items-baseline justify-between">
                      <dt className="font-narrow font-bold text-white uppercase">
                        {t("s3.total")}
                      </dt>
                      <dd className="font-narrow text-2xl font-bold text-white tabular-nums">
                        {fmtCop(total)}
                        <span className="text-silver-400 ml-1 text-xs font-normal">
                          {t("s3.perMonth")}
                        </span>
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    disabled={creando}
                    onClick={() => setShowPago(true)}
                    className="from-amethyst-400 to-amethyst-600 font-narrow mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-b text-sm font-bold tracking-[1px] text-white uppercase shadow-[0_5px_18px_rgba(124,58,237,0.6)] transition hover:brightness-110 disabled:opacity-60"
                  >
                    {creando ? (
                      <SpinnerIcon className="size-4 animate-spin" />
                    ) : (
                      <PlusIcon className="size-4" />
                    )}
                    {t("s3.cta")}
                  </button>
                  <p className="text-silver-500 mt-3 text-center text-[11px] leading-relaxed">
                    {t("s3.note")}
                  </p>
                  {error && (
                    <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                      {error}
                    </p>
                  )}
                </aside>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {showPago && (
        <PaymentMethodPicker
          onPick={crear}
          onClose={() => setShowPago(false)}
          // La insignia premia la trayectoria del ARTISTA; fundar un colectivo
          // no la hereda, así que aquí no aplica descuento por insignia.
          insignia={null}
        />
      )}
    </main>
  );
}

/** Campo del formulario con su etiqueta, en tarjeta de panel. */
function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="bg-ink-panel block rounded-2xl border border-white/[0.08] px-5 py-4">
      <span className="font-narrow text-silver-400 mb-2 block text-[11px] font-semibold tracking-[2px] uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="text-silver-500 mt-2 block text-xs">{hint}</span>}
    </label>
  );
}

function Paso({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/25 transition ring-inset hover:bg-white/20 active:scale-90"
    >
      {children}
    </button>
  );
}

/** COP sin decimales: "120.000". */
function fmtCop(n: number): string {
  return new Intl.NumberFormat("es-CO").format(Math.round(n));
}
