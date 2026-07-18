"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { sedes as seedSedes } from "@/features/sedes/data/sedes";
import { getAllSedes } from "@/features/sedes/lib/sedes-repo";
import type { Sede, SedeId } from "@only-g/shared-types/sede";
import { services } from "@/features/services/data/services";
import { isQuoteOnly, hasVariants, formatCOP } from "@only-g/shared-types/service";
import {
  slotsDeFecha,
  slotsCubiertos,
  estadoDia,
  type DisponibilidadMes,
  type EstadoDia,
} from "@only-g/shared-types/availability";
import { getDisponibilidadMes } from "@/features/availability/lib/availability-repo";
import {
  getDaySlots,
  reservarConSlots,
  type DaySlots,
} from "../lib/booking-repo";
import { ArrowLeftIcon, ClockIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

// Servicios agendables directos: precio fijo y sin variantes (los de variantes
// o "a cotizar" pasan por el wizard de cotizacion).
const AGENDABLES = services.filter((s) => !hasVariants(s) && !isQuoteOnly(s));

const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const fechaStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function BookingCalendar({ servicioSlug }: { servicioSlug?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(0);
  const [sedes, setSedes] = useState<Sede[]>(seedSedes);
  const [sede, setSede] = useState<SedeId>(seedSedes[0].id);
  const [serviceSlug, setServiceSlug] = useState<string>(
    AGENDABLES.some((s) => s.slug === servicioSlug)
      ? servicioSlug!
      : (AGENDABLES[0]?.slug ?? ""),
  );
  const [disp, setDisp] = useState<DisponibilidadMes | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlots>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [startSlot, setStartSlot] = useState<string | null>(null);
  const [hours, setHours] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth());
    setMounted(true);
  }, []);

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

  const mes = ym(year, month);

  useEffect(() => {
    if (!mounted) return;
    let active = true;
    setLoading(true);
    setSelectedDay(null);
    setStartSlot(null);
    Promise.all([getDisponibilidadMes(sede, mes), getDaySlots(sede, mes)])
      .then(([d, ds]) => {
        if (!active) return;
        setDisp(d);
        setDaySlots(ds);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sede, mes, mounted]);

  if (!mounted) {
    return <div className="mx-auto h-[620px] max-w-3xl" aria-hidden="true" />;
  }

  const service = AGENDABLES.find((s) => s.slug === serviceSlug);
  const esPorHora = service?.pricing === "por_hora";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ofertados = (day: number): string[] => {
    if (!disp) return [];
    const weekday = new Date(year, month, day).getDay();
    return slotsDeFecha(disp, fechaStr(year, month, day), weekday);
  };
  const tomados = (day: number): Record<string, string> =>
    daySlots[fechaStr(year, month, day)] ?? {};
  const estado = (day: number): EstadoDia =>
    estadoDia(ofertados(day), Object.keys(tomados(day)));

  /** Horas consecutivas libres desde un slot (1 ventana/dia -> slots contiguos). */
  const maxHoras = (day: number, start: string): number => {
    const off = ofertados(day);
    const tk = tomados(day);
    const idx = off.indexOf(start);
    if (idx < 0) return 0;
    let n = 0;
    for (let i = idx; i < off.length; i++) {
      if (tk[off[i]]) break;
      n++;
    }
    return n;
  };

  function shift(delta: number) {
    setSelectedDay(null);
    setStartSlot(null);
    const m = month + delta;
    if (m < 0) {
      setYear(year - 1);
      setMonth(11);
    } else if (m > 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(m);
    }
  }

  const durationMin = (esPorHora ? hours : 1) * 60;
  const amount = service
    ? esPorHora
      ? (service.basePrice ?? 0) * hours
      : (service.basePrice ?? 0)
    : 0;

  const weekdayHeaders = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
      new Date(2026, 0, 5 + i),
    ),
  );

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));

  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(year, month, 1),
  );

  async function confirmar() {
    if (!user || !service || !selectedDay || !startSlot) return;
    const fecha = fechaStr(year, month, selectedDay);
    const slots = slotsCubiertos(startSlot, durationMin);
    const off = ofertados(selectedDay);
    const tk = tomados(selectedDay);
    if (slots.some((s) => !off.includes(s) || tk[s])) {
      setError(t("bookingCalendar.error.slotUnavailable"));
      return;
    }
    const [h, m] = startSlot.split(":").map(Number);
    const start = new Date(year, month, selectedDay, h, m).getTime();
    setBusy(true);
    setError(null);
    try {
      const id = await reservarConSlots(
        {
          uid: user.uid,
          serviceSlug: service.slug,
          serviceName: service.name,
          sede,
          start,
          durationMin,
          amount,
          clientName: user.displayName ?? undefined,
          clientEmail: user.email ?? undefined,
        },
        { mes, date: fecha, slots },
      );
      setDoneId(id);
    } catch (e) {
      const taken = e instanceof Error && e.message === "SLOT_TAKEN";
      setError(
        taken
          ? t("bookingCalendar.error.slotTaken")
          : t("bookingCalendar.error.bookingFailed"),
      );
      getDaySlots(sede, mes)
        .then(setDaySlots)
        .catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  // -- Pantalla de exito --
  if (doneId) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
        <div className="border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200 flex size-16 items-center justify-center rounded-full border">
          <ClockIcon className="size-8" />
        </div>
        <h2 className="font-narrow mt-6 text-3xl font-bold uppercase sm:text-4xl">
          {t("bookingCalendar.success.title")}
        </h2>
        <p className="text-silver-300 mt-3">
          {t.rich("bookingCalendar.success.description", {
            strong: (c) => <strong>{c}</strong>,
          })}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/cuenta"
            className="from-silver-100 to-amethyst-300 text-ink rounded-full bg-gradient-to-r px-8 py-3 text-sm font-semibold tracking-[2px] uppercase transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
          >
            {t("bookingCalendar.success.goToAccount")}
          </Link>
          <Link
            href="/servicios"
            className="border-silver-300/40 text-silver-100 hover:border-silver-100 rounded-full border px-8 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
          >
            {t("bookingCalendar.success.viewServices")}
          </Link>
        </div>
      </div>
    );
  }

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const dispNoDefinida = !loading && !disp;
  const selectedOfertados = selectedDay ? ofertados(selectedDay) : [];
  const selectedTomados = selectedDay ? tomados(selectedDay) : {};
  const hMax = selectedDay && startSlot ? maxHoras(selectedDay, startSlot) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Servicio */}
      {AGENDABLES.length > 0 && (
        <div className="mb-6">
          <p className="text-silver-300 mb-2 text-xs tracking-[2px] uppercase">
            {t("bookingCalendar.serviceLabel")}
          </p>
          <div className="flex flex-wrap gap-2">
            {AGENDABLES.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => {
                  setServiceSlug(s.slug);
                  setHours(1);
                }}
                data-active={s.slug === serviceSlug}
                className="data-[active=true]:border-amethyst-400 data-[active=true]:bg-amethyst-500/15 rounded-full border border-white/15 px-4 py-2 text-sm transition hover:border-white/40 data-[active=true]:text-white"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sedes */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {sedes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSede(s.id)}
            data-active={sede === s.id}
            className="data-[active=true]:border-amethyst-400/60 data-[active=true]:bg-amethyst-500/10 rounded-xl border border-white/10 px-5 py-4 text-left transition hover:border-white/30"
          >
            <span className="font-narrow block text-2xl font-bold uppercase">
              {s.nombre}
            </span>
            <span className="text-silver-400 text-sm">{s.ciudad}</span>
          </button>
        ))}
      </div>

      {/* Calendario */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={t("bookingCalendar.prevMonth")}
            className="text-silver-200 hover:border-amethyst-300 flex size-11 items-center justify-center rounded-full border border-white/15 transition hover:text-white"
          >
            <ArrowLeftIcon className="size-4" />
          </button>
          <span className="font-narrow text-2xl font-bold uppercase">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={t("bookingCalendar.nextMonth")}
            className="text-silver-200 hover:border-amethyst-300 flex size-11 items-center justify-center rounded-full border border-white/15 transition hover:text-white"
          >
            <ArrowLeftIcon className="size-4 rotate-180" />
          </button>
        </div>

        {dispNoDefinida && (
          <Alert tone="warning" className="mb-4">
            {t("bookingCalendar.noAvailability", { month: monthName })}
          </Alert>
        )}

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdayHeaders.map((w) => (
            <span
              key={w}
              className="text-silver-500 py-2 text-xs tracking-wide uppercase"
            >
              {w}
            </span>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <span key={`e-${i}`} />;
            const d = new Date(year, month, day);
            const past = d < today;
            const est = estado(day);
            const reservable = !past && (est === "libre" || est === "parcial");
            const cls =
              est === "parcial"
                ? "bg-amber-500/15 text-amber-100"
                : est === "lleno"
                  ? "bg-red-500/10 text-red-300/50"
                  : est === "cerrado"
                    ? "text-silver-500/30"
                    : "text-silver-100";
            return (
              <button
                key={day}
                type="button"
                disabled={!reservable}
                onClick={() => {
                  setSelectedDay(day);
                  setStartSlot(null);
                }}
                data-selected={selectedDay === day}
                title={
                  est === "lleno"
                    ? t("bookingCalendar.dayTitle.full")
                    : est === "cerrado"
                      ? t("bookingCalendar.dayTitle.closed")
                      : est === "parcial"
                        ? t("bookingCalendar.dayTitle.partial")
                        : t("bookingCalendar.dayTitle.free")
                }
                className={`data-[selected=true]:from-silver-100 data-[selected=true]:to-amethyst-300 data-[selected=true]:text-ink aspect-square min-h-11 rounded-lg text-sm transition enabled:hover:bg-white/5 disabled:cursor-not-allowed data-[selected=true]:bg-gradient-to-br data-[selected=true]:font-bold ${cls}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="text-silver-400 mt-4 flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-white/15" />{" "}
            {t("bookingCalendar.legend.free")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-amber-500/40" />{" "}
            {t("bookingCalendar.legend.partial")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-red-500/30" />{" "}
            {t("bookingCalendar.legend.full")}
          </span>
        </div>
      </div>

      {/* Horarios del dia */}
      {selectedDay && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-8">
          <p className="text-silver-300 mb-4 text-sm tracking-[2px] uppercase">
            {t("bookingCalendar.slotsHeading", {
              day: selectedDay,
              month: monthName,
            })}
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {selectedOfertados.map((slot) => {
              const taken = !!selectedTomados[slot];
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={taken}
                  onClick={() => {
                    setStartSlot(slot);
                    setHours(1);
                  }}
                  data-active={startSlot === slot}
                  className="enabled:hover:border-amethyst-300 data-[active=true]:border-amethyst-400 data-[active=true]:bg-amethyst-500/15 rounded-lg border border-white/15 py-3 text-sm tabular-nums transition disabled:cursor-not-allowed disabled:bg-red-500/10 disabled:text-red-300/40 disabled:line-through data-[active=true]:text-white"
                >
                  {to12h(slot)}
                </button>
              );
            })}
          </div>

          {/* Duracion (servicios por hora) */}
          {startSlot && esPorHora && hMax > 1 && (
            <div className="mt-5">
              <p className="text-silver-300 mb-2 text-xs tracking-[2px] uppercase">
                {t("bookingCalendar.durationLabel")}
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: hMax }, (_, i) => i + 1).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    data-active={hours === h}
                    className="hover:border-amethyst-300 data-[active=true]:border-amethyst-400 data-[active=true]:bg-amethyst-500/15 rounded-full border border-white/15 px-4 py-2 text-sm transition data-[active=true]:text-white"
                  >
                    {t("bookingCalendar.durationOption", { hours: h })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <Alert tone="error" className="mt-6">
          {error}
        </Alert>
      )}

      {/* Resumen + confirmar */}
      <div className="mt-6">
        {service && selectedDay && startSlot && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
            <span className="text-silver-300">
              {service.name} · {selectedDay} {monthName} · {to12h(startSlot)}
              {esPorHora
                ? ` · ${t("bookingCalendar.durationOption", { hours })}`
                : ""}
            </span>
            <span className="font-semibold text-white">
              {formatCOP(amount)}
            </span>
          </div>
        )}
        <Button
          onClick={confirmar}
          loading={busy}
          disabled={!service || !selectedDay || !startSlot}
          className="w-full"
        >
          {service && selectedDay && startSlot
            ? t("bookingCalendar.cta.reserve", { price: formatCOP(amount) })
            : t("bookingCalendar.cta.placeholder")}
        </Button>
      </div>
    </div>
  );
}
