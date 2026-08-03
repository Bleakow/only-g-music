"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  CUPOS_MAXIMOS,
  cuposLibres,
  inicialesColectivo,
  membresiaEstado,
  puedeGestionar,
  totalMembresia,
  totalMiembros,
  type Colectivo,
  type ColectivoMiembro,
} from "@only-g/shared-types/colectivo";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import type { MetodoPago } from "@only-g/shared-types/payment-method";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { usePrecios } from "@/features/pricing/components/PreciosProvider";
import { PaymentMethodPicker } from "@/features/conversations/components/PaymentMethodPicker";
import { createPaymentConversation } from "@/features/conversations/lib/conversations-repo";
import { openConversation } from "@/features/conversations/lib/open-conversation";
import { RelatedArtistsPicker } from "@/features/artists/components/profile/RelatedArtistsPicker";
import { getProfileBySlug } from "@/features/artists/lib/artist-profile-repo";
import {
  ArrowLeftIcon,
  AwardIcon,
  ChartBarIcon,
  ImageIcon,
  MinusIcon,
  PlusIcon,
  SpinnerIcon,
  StarIcon,
  UsersIcon,
  WalletIcon,
  CalendarIcon,
  LockIcon,
} from "@/components/icons";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { getColectivoBySlug, updateColectivo } from "../lib/colectivos-repo";

/**
 * Panel de control del colectivo (§07, frame `nvGnv`).
 *
 * Solo lo abre quien puede gestionar (el loader lo comprueba). Aquí el fundador
 * ve su ocupación de cupos, gestiona el roster y edita la identidad.
 *
 * HONESTIDAD DE DATOS: los KPIs de cotizaciones e ingresos del mockup necesitan
 * datos que el colectivo todavía no produce (no hay bookings ni facturación por
 * colectivo). En vez de pintar cifras inventadas, sus accesos aparecen con
 * candado y el motivo. Una métrica falsa en un panel de negocio es peor que un
 * hueco honesto.
 */
export function ColectivoPanel({ slug }: { slug: string }) {
  const t = useTranslations("colectivoPanel");
  const tc = useTranslations("colectivos");
  const { user, loading: authLoading } = useAuth();
  const precios = usePrecios();

  const [colectivo, setColectivo] = useState<Colectivo | null>(null);
  const [perfiles, setPerfiles] = useState<Record<string, ArtistProfile>>({});
  const [estado, setEstado] = useState<"cargando" | "ok" | "denegado">(
    "cargando",
  );
  const [guardando, setGuardando] = useState(false);
  const [showMiembros, setShowMiembros] = useState(false);
  const [showIdentidad, setShowIdentidad] = useState(false);
  const [showCupos, setShowCupos] = useState(false);
  const [showPago, setShowPago] = useState(false);
  const [cuposNuevos, setCuposNuevos] = useState(0);

  useEffect(() => {
    // Espera a que la sesión esté resuelta. Sin este guard, el efecto corre con
    // `user` todavía en null y `puedeGestionar` diría que no: el dueño vería
    // "este panel no es tuyo" en su propio colectivo.
    if (authLoading) return;
    let vivo = true;
    getColectivoBySlug(slug)
      .then(async (c) => {
        if (!vivo) return;
        if (!c) {
          setEstado("denegado");
          return;
        }
        // Puerta de gestión. Es una comprobación de UI: quien entre por la URL
        // sin permiso ve el corte, y las REGLAS de Firestore son las que de
        // verdad impiden que escriba nada.
        if (!puedeGestionar(c, user?.uid)) {
          setEstado("denegado");
          return;
        }
        setColectivo(c);
        setEstado("ok");
        // Perfiles del roster, para poner cara y nombre a cada slug.
        const cargados = await Promise.all(
          (c.miembros ?? []).map((m) =>
            getProfileBySlug(m.slug).catch(() => null),
          ),
        );
        if (!vivo) return;
        const mapa: Record<string, ArtistProfile> = {};
        for (const p of cargados) if (p) mapa[p.slug] = p;
        setPerfiles(mapa);
      })
      .catch(() => vivo && setEstado("denegado"));
    return () => {
      vivo = false;
    };
  }, [slug, authLoading, user?.uid]);

  const ahora = Date.now();
  const libres = colectivo ? cuposLibres(colectivo, ahora) : 0;
  const cupos = colectivo?.membresia?.cupos ?? 0;
  const miembros = colectivo ? totalMiembros(colectivo) : 0;
  const membresia = membresiaEstado(colectivo?.membresia, ahora);

  const totalAmpliacion = useMemo(
    () =>
      totalMembresia(cupos + cuposNuevos, {
        precioColectivo: precios.precioColectivo,
        precioCupoColectivo: precios.precioCupoColectivo,
      }),
    [cupos, cuposNuevos, precios],
  );

  async function guardarMiembros(slugs: string[]) {
    if (!colectivo) return;
    setGuardando(true);
    try {
      // Conserva rol y destacado de los que ya estaban; los nuevos entran limpios.
      const previos = new Map(colectivo.miembros.map((m) => [m.slug, m]));
      const siguientes: ColectivoMiembro[] = slugs.map(
        (s) => previos.get(s) ?? { slug: s },
      );
      await updateColectivo(slug, { miembros: siguientes });
      setColectivo({ ...colectivo, miembros: siguientes });
    } finally {
      setGuardando(false);
    }
  }

  async function actualizarMiembro(
    mSlug: string,
    patch: Partial<ColectivoMiembro>,
  ) {
    if (!colectivo) return;
    const siguientes = colectivo.miembros.map((m) =>
      m.slug === mSlug ? { ...m, ...patch } : m,
    );
    setColectivo({ ...colectivo, miembros: siguientes });
    await updateColectivo(slug, { miembros: siguientes });
  }

  async function ampliarCupos(metodo: MetodoPago) {
    if (!user || !colectivo) return;
    setShowPago(false);
    try {
      const id = await createPaymentConversation({
        uid: user.uid,
        concepto: "colectivo",
        ref: { kind: "colectivo", id: slug },
        metodo,
        monto: totalAmpliacion,
      });
      openConversation(id);
      setShowCupos(false);
    } catch (e) {
      console.error("[colectivo-panel] ampliar:", e);
    }
  }

  if (estado === "cargando") {
    return (
      <main className="bg-ink min-h-dvh px-6 pt-10 sm:px-16">
        <Skeleton className="h-10 w-64" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-[18px]" />
          ))}
        </div>
      </main>
    );
  }

  if (estado === "denegado" || !colectivo) {
    return (
      <main className="bg-ink grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <LockIcon className="text-amethyst-300 mx-auto size-8" />
          <h1 className="font-narrow mt-4 text-3xl font-bold text-white uppercase">
            {t("denied")}
          </h1>
          <p className="text-silver-400 mt-2 text-sm">{t("deniedHint")}</p>
          <GlassButton href="/colectivos" className="mt-7">
            <ArrowLeftIcon className="size-4" />
            {tc("backToList")}
          </GlassButton>
        </div>
      </main>
    );
  }

  const accent = colectivo.accent;
  const seleccionados = colectivo.miembros.map((m) => m.slug);

  return (
    <main className="bg-ink min-h-dvh pb-24">
      <div className="mx-auto max-w-400 px-6 pt-8 sm:px-16">
        {/* Cabecera */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/colectivos/${slug}`}
              aria-label={t("back")}
              className={`${glassSurfaceSoft} flex size-11 items-center justify-center rounded-xl text-white/80 transition hover:text-white`}
            >
              <GlassSheen />
              <ArrowLeftIcon className="relative size-4" />
            </Link>
            <span
              className="font-narrow grid size-12 shrink-0 place-items-center rounded-xl text-base font-bold text-white"
              style={{
                background: `linear-gradient(315deg, ${accent}, #1a1626)`,
              }}
            >
              {colectivo.logoURL ? (
                <Image
                  src={colectivo.logoURL}
                  alt=""
                  width={48}
                  height={48}
                  className="size-full rounded-xl object-cover"
                />
              ) : (
                inicialesColectivo(colectivo.nombre)
              )}
            </span>
            <div>
              <h1 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
                {colectivo.nombre}
              </h1>
              <p className="text-silver-400 text-xs">
                {t("subtitle", { tipo: tc(`tipo.${colectivo.tipo}`) })}
              </p>
            </div>
          </div>
          <MembresiaChip estado={membresia} />
        </div>

        {/* KPIs con datos REALES */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            icon={<UsersIcon className="size-5" />}
            value={String(miembros)}
            label={t("kpi.members")}
            sub={t("kpi.membersOf", { cupos })}
            progress={cupos > 0 ? Math.min(100, (miembros / cupos) * 100) : 0}
            accent={accent}
          />
          <Kpi
            icon={<PlusIcon className="size-5" />}
            value={String(libres)}
            label={t("kpi.slots")}
            sub={t("kpi.slotsSub")}
            accent={accent}
          />
          <Kpi
            icon={<CalendarIcon className="size-5" />}
            value="—"
            label={t("kpi.quotes")}
            sub={t("soon")}
            accent={accent}
            muted
          />
          <Kpi
            icon={<WalletIcon className="size-5" />}
            value="—"
            label={t("kpi.income")}
            sub={t("soon")}
            accent={accent}
            muted
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          {/* Accesos rápidos */}
          <section className="bg-ink-panel h-fit rounded-[18px] border border-white/[0.08] p-6">
            <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
              {t("quickAccess")}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Acceso
                icon={<UsersIcon className="size-5" />}
                title={t("access.members")}
                sub={t("access.membersSub")}
                onClick={() => setShowMiembros(true)}
              />
              <Acceso
                icon={<PlusIcon className="size-5" />}
                title={t("access.slots")}
                sub={t("access.slotsSub")}
                onClick={() => {
                  setCuposNuevos(0);
                  setShowCupos(true);
                }}
              />
              <Acceso
                icon={<ImageIcon className="size-5" />}
                title={t("access.identity")}
                sub={t("access.identitySub")}
                onClick={() => setShowIdentidad(true)}
              />
              <Acceso
                icon={<WalletIcon className="size-5" />}
                title={t("access.finance")}
                sub={t("access.financeSub")}
                locked
              />
              <Acceso
                icon={<ChartBarIcon className="size-5" />}
                title={t("access.metrics")}
                sub={t("access.metricsSub")}
                locked
              />
              <Acceso
                icon={<CalendarIcon className="size-5" />}
                title={t("access.quotes")}
                sub={t("access.quotesSub")}
                locked
              />
            </div>
          </section>

          {/* Roster */}
          <section className="bg-ink-panel rounded-[18px] border border-white/[0.08] p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
                  {t(`roster.${colectivo.tipo}`)}
                </h2>
                <p className="text-silver-400 text-xs">
                  {tc("memberCount", { count: miembros })}
                </p>
              </div>
              <Link
                href={`/colectivos/${slug}`}
                className="text-silver-300 text-xs font-semibold tracking-[1px] uppercase transition hover:text-white"
              >
                {t("viewPublic")}
              </Link>
            </div>

            {/* Barra de cupos + invitar */}
            <div
              className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5"
              style={{
                backgroundColor: `${accent}0d`,
                borderColor: `${accent}40`,
              }}
            >
              <div className="min-w-0">
                <p className="font-narrow text-xl font-bold text-white">
                  {miembros} / {cupos || "—"}
                </p>
                <p className="text-silver-400 text-xs">
                  {membresia === "activa"
                    ? t("slotsFree", { count: libres })
                    : t("membershipInactive")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMiembros(true)}
                disabled={membresia !== "activa" || libres === 0}
                className="font-narrow inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-bold tracking-[1px] text-white uppercase transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: `linear-gradient(180deg, ${accent}, ${accent}bb)`,
                }}
              >
                <PlusIcon className="size-4" />
                {t("invite")}
              </button>
            </div>

            {/* Lista */}
            <ul className="mt-5 flex flex-col gap-2">
              {colectivo.miembros.map((m, i) => {
                const p = perfiles[m.slug];
                return (
                  <li
                    key={m.slug}
                    className="flex items-center gap-4 rounded-xl bg-white/[0.03] px-4 py-3"
                  >
                    <span className="font-narrow text-silver-500 w-4 text-sm font-bold tabular-nums">
                      {i + 1}
                    </span>
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                      {p?.photoURL && (
                        <Image
                          src={p.photoURL}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-white">
                        {p?.artisticName ?? m.slug}
                      </span>
                      <input
                        value={m.rol ?? ""}
                        onChange={(e) =>
                          actualizarMiembro(m.slug, { rol: e.target.value })
                        }
                        placeholder={t("rolePlaceholder")}
                        aria-label={t("rolePlaceholder")}
                        className="text-silver-400 w-full bg-transparent text-xs outline-none placeholder:text-white/25"
                      />
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        actualizarMiembro(m.slug, { destacado: !m.destacado })
                      }
                      aria-pressed={!!m.destacado}
                      title={t("featured")}
                      className={`flex size-9 items-center justify-center rounded-full transition ${
                        m.destacado
                          ? "text-amethyst-300"
                          : "text-silver-500 hover:text-white"
                      }`}
                    >
                      <StarIcon
                        className="size-4"
                        fill={m.destacado ? "currentColor" : "none"}
                      />
                    </button>
                  </li>
                );
              })}
              {colectivo.miembros.length === 0 && (
                <li className="text-silver-500 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm">
                  {t("rosterEmpty")}
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>

      {/* ── Modales ──────────────────────────────────────────────────── */}
      <GlassModal
        open={showMiembros}
        onClose={() => setShowMiembros(false)}
        title={t("access.members")}
      >
        <p className="text-silver-300 text-sm leading-relaxed">
          {t("membersModalHint", { libres })}
        </p>
        <div className="mt-5">
          <RelatedArtistsPicker
            value={seleccionados}
            onChange={guardarMiembros}
          />
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          {guardando && (
            <SpinnerIcon className="text-silver-400 size-4 animate-spin" />
          )}
          <GlassButton
            onClick={() => setShowMiembros(false)}
            className="!text-amethyst-200"
          >
            {t("done")}
          </GlassButton>
        </div>
      </GlassModal>

      <IdentidadModal
        open={showIdentidad}
        colectivo={colectivo}
        onClose={() => setShowIdentidad(false)}
        onSaved={(patch) => setColectivo({ ...colectivo, ...patch })}
        slug={slug}
      />

      <GlassModal
        open={showCupos}
        onClose={() => setShowCupos(false)}
        title={t("access.slots")}
      >
        <p className="text-silver-300 text-sm leading-relaxed">
          {t("slotsModalHint", { cupos, libres })}
        </p>
        <div className="mt-5 flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3">
          <span className="text-silver-300 text-sm">{t("addSlots")}</span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCuposNuevos((c) => Math.max(0, c - 1))}
              aria-label={t("less")}
              className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <MinusIcon className="size-4" />
            </button>
            <span className="font-narrow w-10 text-center text-lg font-bold text-white tabular-nums">
              +{cuposNuevos}
            </span>
            <button
              type="button"
              onClick={() =>
                setCuposNuevos((c) => Math.min(CUPOS_MAXIMOS - cupos, c + 1))
              }
              aria-label={t("more")}
              className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <PlusIcon className="size-4" />
            </button>
          </span>
        </div>
        <p className="text-silver-400 mt-4 text-sm">
          {t("newTotal", {
            cupos: cupos + cuposNuevos,
            total: new Intl.NumberFormat("es-CO").format(totalAmpliacion),
          })}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <GlassButton onClick={() => setShowCupos(false)}>
            {t("cancel")}
          </GlassButton>
          <GlassButton
            onClick={() => setShowPago(true)}
            disabled={cuposNuevos === 0}
            className="!text-amethyst-200"
          >
            {t("payRenew")}
          </GlassButton>
        </div>
      </GlassModal>

      {showPago && (
        <PaymentMethodPicker
          onPick={ampliarCupos}
          onClose={() => setShowPago(false)}
          insignia={null}
        />
      )}
    </main>
  );
}

function MembresiaChip({ estado }: { estado: string }) {
  const t = useTranslations("colectivoPanel");
  const map: Record<string, string> = {
    activa: "border-emerald-300/40 bg-emerald-500/10 text-emerald-200",
    vencida: "border-red-300/40 bg-red-500/10 text-red-200",
    ninguna: "border-amber-300/40 bg-amber-500/10 text-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-semibold tracking-[1px] uppercase ${map[estado]}`}
    >
      <AwardIcon className="size-3.5" />
      {t(`membership.${estado}`)}
    </span>
  );
}

function Kpi({
  icon,
  value,
  label,
  sub,
  progress,
  accent,
  muted = false,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sub: string;
  progress?: number;
  accent: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`bg-ink-panel rounded-[18px] border border-white/[0.08] p-6 ${muted ? "opacity-60" : ""}`}
    >
      <span
        className="grid size-11 place-items-center rounded-xl"
        style={{
          backgroundColor: `${accent}14`,
          color: accent,
          boxShadow: `inset 0 0 0 1px ${accent}40`,
        }}
      >
        {icon}
      </span>
      <p className="font-narrow mt-3 text-4xl font-bold text-white">{value}</p>
      <p className="font-narrow text-silver-200 mt-1 text-[12px] font-semibold tracking-[2px] uppercase">
        {label}
      </p>
      <p className="text-silver-400 text-xs">{sub}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, backgroundColor: accent }}
          />
        </div>
      )}
    </div>
  );
}

function Acceso({
  icon,
  title,
  sub,
  onClick,
  locked = false,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick?: () => void;
  locked?: boolean;
}) {
  const t = useTranslations("colectivoPanel");
  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      disabled={locked}
      title={locked ? t("soon") : undefined}
      className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
        locked
          ? "cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-55"
          : "border-white/[0.08] bg-white/[0.03] hover:border-white/25"
      }`}
    >
      <span
        className={`grid size-9 place-items-center rounded-lg ${
          locked
            ? "text-silver-500 bg-white/5"
            : "bg-amethyst-500/10 text-amethyst-300 ring-amethyst-300/25 ring-1 ring-inset"
        }`}
      >
        {locked ? <LockIcon className="size-4" /> : icon}
      </span>
      <span className="font-narrow text-sm font-bold tracking-wide text-white">
        {title}
      </span>
      <span className="text-silver-400 text-xs leading-snug">{sub}</span>
    </button>
  );
}

/** Editor de identidad: nombre, descripción, ciudad y color. */
function IdentidadModal({
  open,
  colectivo,
  slug,
  onClose,
  onSaved,
}: {
  open: boolean;
  colectivo: Colectivo;
  slug: string;
  onClose: () => void;
  onSaved: (patch: Partial<Colectivo>) => void;
}) {
  const t = useTranslations("colectivoPanel");
  const [nombre, setNombre] = useState(colectivo.nombre);
  const [descripcion, setDescripcion] = useState(colectivo.descripcion ?? "");
  const [ciudad, setCiudad] = useState(colectivo.ciudad ?? "");
  const [accent, setAccent] = useState(colectivo.accent);
  const [busy, setBusy] = useState(false);

  async function guardar() {
    setBusy(true);
    try {
      const patch = {
        nombre: nombre.trim() || colectivo.nombre,
        descripcion: descripcion.trim() || undefined,
        ciudad: ciudad.trim() || undefined,
        accent,
      };
      await updateColectivo(slug, patch);
      onSaved(patch);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const INPUT =
    "w-full rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-silver-50 outline-none ring-1 ring-inset ring-white/15 transition focus:ring-amethyst-300/70 placeholder:text-white/25";

  return (
    <GlassModal open={open} onClose={onClose} title={t("access.identity")}>
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="font-narrow text-silver-400 mb-1.5 block text-[10px] font-semibold tracking-[2px] uppercase">
            {t("identity.name")}
          </span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="font-narrow text-silver-400 mb-1.5 block text-[10px] font-semibold tracking-[2px] uppercase">
            {t("identity.city")}
          </span>
          <input
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="font-narrow text-silver-400 mb-1.5 block text-[10px] font-semibold tracking-[2px] uppercase">
            {t("identity.description")}
          </span>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className={`${INPUT} min-h-24 resize-y leading-relaxed`}
          />
        </label>
        <label className="flex items-center gap-3">
          <span className="font-narrow text-silver-400 text-[10px] font-semibold tracking-[2px] uppercase">
            {t("identity.color")}
          </span>
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="size-9 cursor-pointer rounded-lg border border-white/20 bg-transparent"
          />
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <GlassButton onClick={onClose}>{t("cancel")}</GlassButton>
        <GlassButton
          onClick={guardar}
          disabled={busy}
          className="!text-amethyst-200"
        >
          {busy ? <SpinnerIcon className="size-4 animate-spin" /> : null}
          {t("save")}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
