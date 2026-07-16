"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { listAllQuotes } from "@/features/quotes/lib/quotes-repo";
import { listAllBookings } from "@/features/booking/lib/booking-repo";
import type { QuoteRequest } from "@only-g/shared-types/quote";
import type { Reserva } from "@only-g/shared-types/booking";
import { isReservaActiva } from "@only-g/shared-types/booking";
import { formatCOP } from "@only-g/shared-types/service";
import { esCeo } from "@only-g/shared-types/user";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { badgeClass, fechaCorta } from "@/features/solicitudes/lib/estados";
import { glassSurface, GlassSheen } from "@/components/ui/glass";
import {
  CalendarIcon,
  PaymentIcon,
  QuoteIcon,
  FinanceIcon,
  ArtistIcon,
  ProducersIcon,
  StudioIcon,
  MusicIcon,
  KebabIcon,
  ArrowRightIcon,
} from "./admin-icons";
import { adminCard, adminInner } from "./admin-ui";
import { Skeleton } from "@/components/ui/Skeleton";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const pad = (n: number) => String(n).padStart(2, "0");

// Contenedor translúcido (deja ver la imagen de fondo a través del cristal) +
// backing oscuro y frosteado para las opciones internas (legibilidad del texto).
const OUTER = `${adminCard} p-5`;
const INNER = adminInner;

const QUICK: { key: string; sub: string; href: string; Icon: Icon }[] = [
  {
    key: "finanzas",
    sub: "quickFinanzasSub",
    href: "/admin/finanzas",
    Icon: FinanceIcon,
  },
  {
    key: "artistas",
    sub: "quickArtistasSub",
    href: "/admin/perfiles",
    Icon: ArtistIcon,
  },
  {
    key: "productores",
    sub: "quickProductoresSub",
    href: "/admin/productores",
    Icon: ProducersIcon,
  },
  {
    key: "estudios",
    sub: "quickEstudiosSub",
    href: "/admin/estudios",
    Icon: StudioIcon,
  },
  {
    key: "pagos",
    sub: "quickPagosSub",
    href: "/admin/pagos",
    Icon: PaymentIcon,
  },
  {
    key: "cotizaciones",
    sub: "quickCotizacionesSub",
    href: "/admin/cotizaciones",
    Icon: QuoteIcon,
  },
  {
    key: "roles",
    sub: "quickRolesSub",
    href: "/admin/roles",
    // Sin icono propio: reutilizamos ArtistIcon (silueta de una persona), ya
    // que "roles" trata de ajustar los permisos de UN usuario a la vez.
    Icon: ArtistIcon,
  },
  {
    key: "convenios",
    sub: "quickConveniosSub",
    href: "/admin/convenios",
    // Sin icono propio: reutilizamos ProducersIcon, ya que aprobar un convenio
    // es justo lo que da de alta a un productor/beatmaker en la plataforma.
    Icon: ProducersIcon,
  },
  {
    key: "beats",
    sub: "quickBeatsSub",
    href: "/admin/beats",
    Icon: MusicIcon,
  },
];

/**
 * Acceso EXCLUSIVO del CEO (config comercial: comisiones + precios). No va en
 * `QUICK` porque solo se muestra si la cuenta tiene rol `ceo`. Reutiliza
 * FinanceIcon (es dinero/config), como el resto del panel reutiliza iconos.
 */
const QUICK_CEO = {
  key: "ceo",
  sub: "quickCeoSub",
  href: "/admin/ceo",
  Icon: FinanceIcon as Icon,
};

function StatCard({
  Icon,
  value,
  label,
  sub,
  subClass,
}: {
  Icon: Icon;
  value: string;
  label: string;
  sub: string;
  subClass?: string;
}) {
  return (
    <div className={`${glassSurface} relative overflow-hidden rounded-2xl p-5`}>
      <GlassSheen />
      <div className="relative flex items-start gap-4">
        <span className="bg-amethyst-500/20 text-amethyst-200 ring-amethyst-400/30 flex size-12 shrink-0 items-center justify-center rounded-xl ring-1">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="font-narrow text-4xl leading-none font-bold text-white">
            {value}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-white">{label}</p>
          <p className={`mt-0.5 text-xs ${subClass ?? "text-silver-400"}`}>
            {sub}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const t = useTranslations();
  const locale = useLocale();
  const { account } = useAuth();

  // El acceso a la herramienta del CEO solo aparece para cuentas con rol `ceo`.
  const quickItems = esCeo(account) ? [...QUICK, QUICK_CEO] : QUICK;

  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listAllQuotes(), listAllBookings()])
      .then(([q, r]) => {
        if (!active) return;
        setQuotes(q);
        setReservas(r);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[admin] error:", e);
        setError(t("adminDashboard.loadError"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const activas = reservas.filter((r) => isReservaActiva(r.estado));
  const pendientesPagos = reservas.filter(
    (r) => r.estado === "pago_en_revision",
  ).length;
  const pendientesQuotes = quotes.filter(
    (q) => q.status === "pendiente",
  ).length;

  // Actividad: cotizaciones + reservas más recientes, mezcladas por fecha.
  const activity = [
    ...quotes.map((q) => ({
      id: `q-${q.id}`,
      Icon: QuoteIcon as Icon,
      text: t("adminDashboard.activityQuote", { name: q.contactName }),
      at: q.createdAt,
    })),
    ...reservas.map((r) => ({
      id: `r-${r.id}`,
      Icon: CalendarIcon as Icon,
      text: t("adminDashboard.activityBooking", { name: r.serviceName }),
      at: r.createdAt,
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 5);

  return (
    <main className="pb-16">
      {/* Cabecera (el fondo de imagen lo pone ahora el shell del panel). */}
      <header className="px-6 pt-20 pb-10 sm:px-10 sm:pt-24 sm:pb-12">
        <p className="text-amethyst-300 text-xs font-semibold tracking-[4px] uppercase">
          {t("adminDashboard.eyebrow")}
        </p>
        <h1 className="font-narrow mt-2 text-5xl leading-[0.9] font-bold uppercase drop-shadow-[0_2px_16px_rgba(0,0,0,0.75)] sm:text-7xl">
          {t("adminDashboard.title")}
        </h1>
        <p className="text-silver-200 mt-4 max-w-md text-sm drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)] sm:text-base">
          {t("adminDashboard.subtitle")}
        </p>
      </header>

      <div className="px-6 sm:px-10">
        {error && (
          <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        {loading ? (
          <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-5">
            {/* Stat cards (skeleton) */}
            <section className="order-2 grid gap-4 sm:grid-cols-3 lg:order-1 lg:col-span-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={`${glassSurface} relative overflow-hidden rounded-2xl p-5`}
                >
                  <div className="relative flex items-start gap-4">
                    <Skeleton className="size-12 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="mt-2 h-4 w-24" />
                      <Skeleton className="mt-1 h-3 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* Accesos rápidos (skeleton) */}
            <section className={`${OUTER} order-1 lg:order-2 lg:col-span-2`}>
              <Skeleton className="h-5 w-40" />
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex flex-col gap-2 rounded-xl ${INNER} p-3`}
                  >
                    <Skeleton className="size-9 rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            </section>

            {/* Actividad reciente (skeleton) */}
            <section className={`${OUTER} order-4 lg:col-span-2`}>
              <Skeleton className="h-5 w-32" />
              <div className="mt-3 flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`${INNER} flex items-center gap-3 rounded-xl p-2.5`}
                  >
                    <Skeleton className="size-8 shrink-0 rounded-lg" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-3 w-12 shrink-0" />
                  </div>
                ))}
              </div>
            </section>

            {/* Reservas activas (skeleton) */}
            <section className={`${OUTER} order-3 lg:col-span-3 lg:row-span-2`}>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-xl ${INNER} p-3`}
                  >
                    <Skeleton className="size-11 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="mt-2 h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <>
            {/* Contenedor reordenable: en MÓVIL (flex-col) el orden es accesos →
                stats → reservas → actividad; en DESKTOP (grid) es la maqueta de
                2 columnas (stats arriba, accesos+actividad izq, reservas der). */}
            <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-5">
              {/* Stat cards */}
              <section className="order-2 grid gap-4 sm:grid-cols-3 lg:order-1 lg:col-span-5">
                <StatCard
                  Icon={CalendarIcon}
                  value={pad(activas.length)}
                  label={t("adminDashboard.statBookings")}
                  sub={t("adminDashboard.bookingsActive")}
                />
                <StatCard
                  Icon={PaymentIcon}
                  value={pad(pendientesPagos)}
                  label={t("adminDashboard.statPayments")}
                  sub={t("adminDashboard.statPendingResponse")}
                  subClass={pendientesPagos > 0 ? "text-sky-300" : undefined}
                />
                <StatCard
                  Icon={QuoteIcon}
                  value={pad(pendientesQuotes)}
                  label={t("adminDashboard.statQuotes")}
                  sub={t("adminDashboard.statPendingResponse")}
                  subClass={pendientesQuotes > 0 ? "text-amber-300" : undefined}
                />
              </section>

              {/* Accesos rápidos */}
              <section className={`${OUTER} order-1 lg:order-2 lg:col-span-2`}>
                <GlassSheen />
                <div className="relative">
                  <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
                    {t("adminDashboard.quickTitle")}
                  </h2>
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    {quickItems.map(({ key, sub, href, Icon }) => (
                      <Link
                        key={key}
                        href={href}
                        className={`group flex flex-col gap-2 rounded-xl ${INNER} p-3 transition hover:bg-black/35 hover:ring-white/25`}
                      >
                        <span className="text-amethyst-200 flex size-9 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/15 ring-inset">
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white">
                            {t(`adminNav.${key}`)}
                          </span>
                          <span className="text-silver-400 block truncate text-[0.7rem]">
                            {t(`adminDashboard.${sub}`)}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>

              {/* Actividad reciente */}
              <section className={`${OUTER} order-4 lg:col-span-2`}>
                <GlassSheen />
                <div className="relative">
                  <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
                    {t("adminDashboard.activityTitle")}
                  </h2>
                  {activity.length === 0 ? (
                    <p className="text-silver-400 mt-3 text-sm">
                      {t("adminDashboard.noActivity")}
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2">
                      {activity.map(({ id, Icon, text, at }) => (
                        <li
                          key={id}
                          className={`${INNER} flex items-center gap-3 rounded-xl p-2.5`}
                        >
                          <span className="text-silver-300 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] ring-1 ring-white/12 ring-inset">
                            <Icon className="size-4" />
                          </span>
                          <span className="text-silver-200 min-w-0 flex-1 truncate text-sm">
                            {text}
                          </span>
                          <span className="text-silver-500 shrink-0 text-xs">
                            {fechaCorta(at, locale)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* Reservas activas */}
              <section
                className={`${OUTER} order-3 lg:col-span-3 lg:row-span-2`}
              >
                <GlassSheen />
                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
                      {t("adminDashboard.bookingsActive")}
                    </h2>
                    <Link
                      href="/admin/finanzas"
                      className="text-amethyst-200 flex items-center gap-1 text-xs font-semibold tracking-wide uppercase transition hover:text-white"
                    >
                      {t("adminDashboard.viewAll")}
                      <ArrowRightIcon className="size-3.5" />
                    </Link>
                  </div>

                  {activas.length === 0 ? (
                    <p className="text-silver-400 mt-4 text-sm">
                      {t("adminDashboard.noBookings")}
                    </p>
                  ) : (
                    <ul className="mt-4 flex flex-col gap-2.5">
                      {activas.map((r) => (
                        <li key={r.id}>
                          <Link
                            href={`/admin/reserva/${r.id}`}
                            className={`flex items-center gap-3 rounded-xl ${INNER} p-3 transition hover:bg-black/35 hover:ring-white/25`}
                          >
                            <span className="text-amethyst-200 flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/15 ring-inset">
                              <MusicIcon className="size-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-white">
                                {r.serviceName}
                              </span>
                              <span className="text-silver-400 block truncate text-xs">
                                {fechaCorta(r.start, locale)}
                              </span>
                            </span>
                            <span className="hidden shrink-0 text-sm font-semibold text-white sm:block">
                              {formatCOP(r.amount ?? 0)}
                            </span>
                            <span
                              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${badgeClass(r.estado)}`}
                            >
                              {t(`status.${r.estado}`)}
                            </span>
                            <KebabIcon className="text-silver-500 size-4 shrink-0" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
