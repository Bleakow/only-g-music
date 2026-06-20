"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { sedes } from "@/features/sedes/data/sedes";
import type { SedeId } from "@/domain/sede";
import { services } from "@/features/services/data/services";
import { isQuoteOnly, hasVariants, formatCOP } from "@/domain/service";
import {
  slotsDeFecha,
  slotsCubiertos,
  estadoDia,
  type DisponibilidadMes,
  type EstadoDia,
} from "@/domain/availability";
import { getDisponibilidadMes } from "@/features/availability/lib/availability-repo";
import {
  getDaySlots,
  reservarConSlots,
  type DaySlots,
} from "../lib/booking-repo";
import { ArrowLeftIcon, ClockIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Servicios agendables directos: precio fijo y sin variantes (los de variantes
// o "a cotizar" pasan por el wizard de cotización).
const AGENDABLES = services.filter((s) => !hasVariants(s) && !isQuoteOnly(s));

const ym = (y: number, m: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}`;
const fechaStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function BookingCalendar({ servicioSlug }: { servicioSlug?: string }) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(0);
  const [sede, setSede] = useState<SedeId>(sedes[0].id);
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

  /** Horas consecutivas libres desde un slot (1 ventana/día → slots contiguos). */
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

  async function confirmar() {
    if (!user || !service || !selectedDay || !startSlot) return;
    const fecha = fechaStr(year, month, selectedDay);
    const slots = slotsCubiertos(startSlot, durationMin);
    const off = ofertados(selectedDay);
    const tk = tomados(selectedDay);
    if (slots.some((s) => !off.includes(s) || tk[s])) {
      setError("Ese horario ya no está disponible. Elige otro.");
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
          ? "Alguien acaba de tomar ese horario. Elige otro."
          : "No se pudo reservar. Inténtalo de nuevo.",
      );
      getDaySlots(sede, mes).then(setDaySlots).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  // ── Pantalla de éxito ───────────────────────────────────────────────
  if (doneId) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200">
          <ClockIcon className="size-8" />
        </div>
        <h2 className="mt-6 font-narrow text-3xl font-bold uppercase sm:text-4xl">
          ¡Reserva registrada!
        </h2>
        <p className="mt-3 text-silver-300">
          Tu reserva quedó <strong>pendiente de pago</strong>. Te contactaremos
          para confirmar el pago y dejarla agendada.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/cuenta"
            className="rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-8 py-3 text-sm font-semibold uppercase tracking-[2px] text-ink transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
          >
            Ir a mi cuenta
          </Link>
          <Link
            href="/servicios"
            className="rounded-full border border-silver-300/40 px-8 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
          >
            Ver servicios
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
          <p className="mb-2 text-xs uppercase tracking-[2px] text-silver-300">
            Servicio
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
                className="rounded-full border border-white/15 px-4 py-2 text-sm transition hover:border-white/40 data-[active=true]:border-amethyst-400 data-[active=true]:bg-amethyst-500/15 data-[active=true]:text-white"
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
            className="rounded-xl border border-white/10 px-5 py-4 text-left transition hover:border-white/30 data-[active=true]:border-amethyst-400/60 data-[active=true]:bg-amethyst-500/10"
          >
            <span className="block font-narrow text-2xl font-bold uppercase">
              {s.nombre}
            </span>
            <span className="text-sm text-silver-400">{s.ciudad}</span>
          </button>
        ))}
      </div>

      {/* Calendario */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Mes anterior"
            className="flex size-10 items-center justify-center rounded-full border border-white/15 text-silver-200 transition hover:border-amethyst-300 hover:text-white"
          >
            <ArrowLeftIcon className="size-4" />
          </button>
          <span className="font-narrow text-2xl font-bold uppercase">
            {MONTHS[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Mes siguiente"
            className="flex size-10 items-center justify-center rounded-full border border-white/15 text-silver-200 transition hover:border-amethyst-300 hover:text-white"
          >
            <ArrowLeftIcon className="size-4 rotate-180" />
          </button>
        </div>

        {dispNoDefinida && (
          <p className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            El productor de esta sede aún no publicó su disponibilidad para{" "}
            {MONTHS[month]}. Prueba otro mes u otra sede.
          </p>
        )}

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <span
              key={w}
              className="py-2 text-xs uppercase tracking-wide text-silver-500"
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
                    ? "Sin cupos"
                    : est === "cerrado"
                      ? "No disponible"
                      : est === "parcial"
                        ? "Quedan cupos"
                        : "Disponible"
                }
                className={`aspect-square rounded-lg text-sm transition disabled:cursor-not-allowed enabled:hover:bg-white/5 data-[selected=true]:bg-gradient-to-br data-[selected=true]:from-silver-100 data-[selected=true]:to-amethyst-300 data-[selected=true]:font-bold data-[selected=true]:text-ink ${cls}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-silver-400">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-white/15" /> Disponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-amber-500/40" /> Quedan cupos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-red-500/30" /> Lleno
          </span>
        </div>
      </div>

      {/* Horarios del día */}
      {selectedDay && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-8">
          <p className="mb-4 text-sm uppercase tracking-[2px] text-silver-300">
            Horarios · {selectedDay} {MONTHS[month]}
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {selectedOfertados.map((t) => {
              const taken = !!selectedTomados[t];
              return (
                <button
                  key={t}
                  type="button"
                  disabled={taken}
                  onClick={() => {
                    setStartSlot(t);
                    setHours(1);
                  }}
                  data-active={startSlot === t}
                  className="rounded-lg border border-white/15 py-3 text-sm tabular-nums transition enabled:hover:border-amethyst-300 disabled:cursor-not-allowed disabled:bg-red-500/10 disabled:text-red-300/40 disabled:line-through data-[active=true]:border-amethyst-400 data-[active=true]:bg-amethyst-500/15 data-[active=true]:text-white"
                >
                  {to12h(t)}
                </button>
              );
            })}
          </div>

          {/* Duración (servicios por hora) */}
          {startSlot && esPorHora && hMax > 1 && (
            <div className="mt-5">
              <p className="mb-2 text-xs uppercase tracking-[2px] text-silver-300">
                Duración
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: hMax }, (_, i) => i + 1).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    data-active={hours === h}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm transition hover:border-amethyst-300 data-[active=true]:border-amethyst-400 data-[active=true]:bg-amethyst-500/15 data-[active=true]:text-white"
                  >
                    {h} h
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      {/* Resumen + confirmar */}
      <div className="mt-6">
        {service && selectedDay && startSlot && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
            <span className="text-silver-300">
              {service.name} · {selectedDay} {MONTHS[month]} · {to12h(startSlot)}
              {esPorHora ? ` · ${hours} h` : ""}
            </span>
            <span className="font-semibold text-white">{formatCOP(amount)}</span>
          </div>
        )}
        <Button
          onClick={confirmar}
          loading={busy}
          disabled={!service || !selectedDay || !startSlot}
          className="w-full"
        >
          {service && selectedDay && startSlot
            ? `Reservar · ${formatCOP(amount)}`
            : "Elige servicio, día y hora"}
        </Button>
      </div>
    </div>
  );
}
