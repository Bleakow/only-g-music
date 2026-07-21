"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { SedeId } from "@only-g/shared-types/sede";
import {
  slotsDeFecha,
  slotsCubiertos,
  estadoDia,
  type DisponibilidadMes,
  type EstadoDia,
} from "@only-g/shared-types/availability";
import { getDisponibilidadMes } from "@/features/availability/lib/availability-repo";
import { getDaySlots, type DaySlots } from "../lib/booking-repo";
import { ArrowLeftIcon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";

const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const fechaStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** "HH:mm" + minutos → "HH:mm" (para calcular la hora de FIN de la sesión). */
function addHhmm(hhmm: string, addMin: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + addMin;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Selección resuelta de una línea de sesión: lista para volcar en
 *  `PedidoLineaInput` (start/durationMin/slotCtx). */
export interface SessionSlotValue {
  mes: string;
  date: string;
  startSlot: string;
  slots: string[];
  start: number;
  durationMin: number;
}

/**
 * Selector de fecha + hora para UNA línea de sesión del carrito de compra
 * (servicio/variante `por_hora`). Reusa los mismos primitivos de
 * disponibilidad que `BookingCalendar` (getDisponibilidadMes + getDaySlots +
 * `@only-g/shared-types/availability`), pero aquí la duración es FIJA: las
 * horas ya se eligieron como cantidad en el paso del carrito, así que solo
 * hace falta un inicio con hueco contiguo suficiente. NO modifica
 * `BookingCalendar` — es un componente hermano, más angosto.
 */
export function SessionSlotPicker({
  sede,
  requiredHours,
  blockedByOtherLines,
  onChange,
}: {
  sede: SedeId;
  requiredHours: number;
  /** Slots "HH:mm" por fecha ya elegidos por OTRAS líneas de sesión del mismo
   *  pedido (misma sede): se pintan/tratan como tomados para no pisarlos. */
  blockedByOtherLines?: Record<string, string[]>;
  onChange: (value: SessionSlotValue | null) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(0);
  const [disp, setDisp] = useState<DisponibilidadMes | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlots>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [startSlot, setStartSlot] = useState<string | null>(null);

  // Ref estable para no meter `onChange` (recreado en cada render del padre)
  // como dependencia del efecto de carga — evita refetch/loops espurios.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

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
    onChangeRef.current(null);
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
  }, [sede, mes, mounted, requiredHours]);

  if (!mounted) {
    return <div className="h-52 rounded-2xl bg-white/[0.02]" aria-hidden="true" />;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ofertados = (day: number): string[] => {
    if (!disp) return [];
    const weekday = new Date(year, month, day).getDay();
    return slotsDeFecha(disp, fechaStr(year, month, day), weekday);
  };
  const tomados = (day: number): Record<string, string> => {
    const server = daySlots[fechaStr(year, month, day)] ?? {};
    const blocked = blockedByOtherLines?.[fechaStr(year, month, day)] ?? [];
    if (blocked.length === 0) return server;
    const merged = { ...server };
    for (const s of blocked) if (!merged[s]) merged[s] = "local";
    return merged;
  };
  const estado = (day: number): EstadoDia =>
    estadoDia(ofertados(day), Object.keys(tomados(day)));

  /** Horas consecutivas libres desde un slot (misma lógica que BookingCalendar). */
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

  function pick(day: number, slot: string) {
    if (tomados(day)[slot]) return;
    if (maxHoras(day, slot) < requiredHours) return;
    setStartSlot(slot);
    const date = fechaStr(year, month, day);
    const durationMin = requiredHours * 60;
    const slots = slotsCubiertos(slot, durationMin);
    const [h, m] = slot.split(":").map(Number);
    const start = new Date(year, month, day, h, m).getTime();
    onChangeRef.current({ mes, date, startSlot: slot, slots, start, durationMin });
  }

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

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const dispNoDefinida = !loading && !disp;
  const selectedOfertados = selectedDay ? ofertados(selectedDay) : [];
  const selectedTomados = selectedDay ? tomados(selectedDay) : {};
  // Casillas que OCUPARÁ la reserva desde el inicio elegido (TODAS las horas, no
  // solo la de llegada) — se resaltan para dejar claro el rango al comprador.
  const coveredSlots = startSlot
    ? slotsCubiertos(startSlot, requiredHours * 60)
    : [];
  const endSlot = startSlot ? addHhmm(startSlot, requiredHours * 60) : null;

  return (
    <div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={t("bookingCalendar.prevMonth")}
            className="text-silver-200 hover:border-amethyst-300 flex size-9 items-center justify-center rounded-full border border-white/15 transition hover:text-white"
          >
            <ArrowLeftIcon className="size-3.5" />
          </button>
          <span className="font-narrow text-lg font-bold uppercase">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={t("bookingCalendar.nextMonth")}
            className="text-silver-200 hover:border-amethyst-300 flex size-9 items-center justify-center rounded-full border border-white/15 transition hover:text-white"
          >
            <ArrowLeftIcon className="size-3.5 rotate-180" />
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
              className="text-silver-500 py-1.5 text-[11px] tracking-wide uppercase"
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
                onClick={() => setSelectedDay(day)}
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
                className={`data-[selected=true]:from-silver-100 data-[selected=true]:to-amethyst-300 data-[selected=true]:text-ink aspect-square min-h-9 rounded-md text-sm transition enabled:hover:bg-white/5 disabled:cursor-not-allowed data-[selected=true]:bg-gradient-to-br data-[selected=true]:font-bold ${cls}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {selectedDay && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-silver-300 mb-3 text-xs tracking-[2px] uppercase">
              {t("bookingCalendar.slotsHeading", {
                day: selectedDay,
                month: monthName,
              })}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {selectedOfertados.map((slot) => {
                const taken = !!selectedTomados[slot];
                const fits = maxHoras(selectedDay, slot) >= requiredHours;
                const disabled = taken || !fits;
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(selectedDay, slot)}
                    data-active={startSlot === slot}
                    data-covered={coveredSlots.includes(slot) && slot !== startSlot}
                    className="enabled:hover:border-amethyst-300 data-[covered=true]:border-amethyst-400/50 data-[covered=true]:bg-amethyst-500/10 data-[covered=true]:text-amethyst-100 data-[active=true]:border-amethyst-400 data-[active=true]:bg-amethyst-500/25 rounded-lg border border-white/15 py-2.5 text-sm tabular-nums transition disabled:cursor-not-allowed disabled:opacity-30 data-[active=true]:text-white"
                  >
                    {to12h(slot)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedDay && startSlot && endSlot && (
        <p className="text-silver-200 mt-3 text-sm">
          {t("compraWizard.slotSelectedRange", {
            date: `${selectedDay} ${monthName}`,
            start: to12h(startSlot),
            end: to12h(endSlot),
            hours: requiredHours,
          })}
        </p>
      )}
    </div>
  );
}
