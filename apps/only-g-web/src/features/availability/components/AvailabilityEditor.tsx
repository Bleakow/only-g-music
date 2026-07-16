"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { sedes as seedSedes } from "@/features/sedes/data/sedes";
import { getAllSedes } from "@/features/sedes/lib/sedes-repo";
import type { Sede, SedeId } from "@only-g/shared-types/sede";
import {
  plantillaPorDefecto,
  slotsDeVentana,
  type PlantillaSemanal,
  type VentanaHoraria,
} from "@only-g/shared-types/availability";
import {
  getDisponibilidadMes,
  saveDisponibilidadMes,
} from "../lib/availability-repo";
import { ArrowLeftIcon, CopyIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { TimePicker } from "@/components/ui/TimePicker";

// Orden de visualización Lun→Dom; el índice es el de Date.getDay() (0=Dom).
// Las fechas de referencia (semana del 05-01-2026) se usan sólo para obtener
// los nombres de día vía Intl; el año/mes no importa.
const WEEKDAY_INDICES = [1, 2, 3, 4, 5, 6, 0];
// Lunes de referencia: 2026-01-05
const REF_MONDAY = new Date(2026, 0, 5);

const DEFAULT_VENTANA: VentanaHoraria = { desde: "10:00", hasta: "16:00" };

const emptyPlantilla = (): PlantillaSemanal => ({
  0: null,
  1: null,
  2: null,
  3: null,
  4: null,
  5: null,
  6: null,
});

const ym = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}`;
const fechaStr = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function AvailabilityEditor() {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(0);
  const [sedes, setSedes] = useState<Sede[]>(seedSedes);
  const [sedeId, setSedeId] = useState<SedeId>(seedSedes[0].id);
  const [plantilla, setPlantilla] = useState<PlantillaSemanal>(emptyPlantilla);
  const [excepciones, setExcepciones] = useState<
    Record<string, VentanaHoraria | null>
  >({});
  const [loaded, setLoaded] = useState(false);
  const [defined, setDefined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  // Cargar disponibilidad al cambiar sede/mes.
  useEffect(() => {
    if (!mounted) return;
    let active = true;
    setLoaded(false);
    setMsg(null);
    getDisponibilidadMes(sedeId, mes)
      .then((d) => {
        if (!active) return;
        if (d) {
          setPlantilla({ ...emptyPlantilla(), ...d.plantilla });
          setExcepciones(d.excepciones);
          setDefined(true);
        } else {
          setPlantilla(emptyPlantilla());
          setExcepciones({});
          setDefined(false);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [sedeId, mes, mounted]);

  if (!mounted) {
    return <div className="mx-auto h-[700px] max-w-3xl" aria-hidden="true" />;
  }

  function ventana(fecha: string, weekday: number): VentanaHoraria | null {
    if (Object.prototype.hasOwnProperty.call(excepciones, fecha)) {
      return excepciones[fecha];
    }
    return plantilla[weekday] ?? null;
  }

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

  function toggleDia(fecha: string, weekday: number) {
    const trabaja = ventana(fecha, weekday) != null;
    setExcepciones((prev) => ({
      ...prev,
      [fecha]: trabaja ? null : (plantilla[weekday] ?? DEFAULT_VENTANA),
    }));
  }

  /** Multiplica una ventana a los 7 días (activa también los que estén libres). */
  function copiarADias(window: VentanaHoraria) {
    const next: PlantillaSemanal = {};
    for (let i = 0; i <= 6; i++) next[i] = { ...window };
    setPlantilla(next);
    setMsg(t("availability.scheduleAppliedAll"));
  }

  async function guardar() {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    try {
      await saveDisponibilidadMes({
        sedeId,
        productorId: user.uid,
        mes,
        plantilla,
        excepciones,
      });
      setDefined(true);
      setMsg(t("availability.saved"));
    } catch (e) {
      console.error("[disponibilidad] error:", e);
      setMsg(t("availability.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function copiarFuturos(meses: number) {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    try {
      for (let i = 1; i <= meses; i++) {
        const d = new Date(year, month + i, 1);
        await saveDisponibilidadMes({
          sedeId,
          productorId: user.uid,
          mes: ym(d.getFullYear(), d.getMonth()),
          plantilla,
          excepciones: {},
        });
      }
      setMsg(t("availability.copiedToFuture", { count: meses }));
    } catch (e) {
      console.error("[disponibilidad] error:", e);
      setMsg(t("availability.copyError"));
    } finally {
      setBusy(false);
    }
  }

  // Celdas del mes (lunes primero).
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Helpers de formato Intl — no dependen de estado, se recalculan por render.
  const fmtMonthLong = new Intl.DateTimeFormat(locale, { month: "long" });
  const fmtWeekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const fmtWeekdayShort = new Intl.DateTimeFormat(locale, { weekday: "short" });

  /** Nombre largo del día (ej. "lunes") para un idx Date.getDay(). */
  function weekdayLong(idx: number): string {
    // REF_MONDAY es lunes (idx=1). Offset: idx===0 → domingo → +6 días desde lunes.
    const offset = idx === 0 ? 6 : idx - 1;
    const d = new Date(REF_MONDAY);
    d.setDate(REF_MONDAY.getDate() + offset);
    return fmtWeekdayLong.format(d);
  }

  /** Nombre corto del día (ej. "lun.") para un idx Date.getDay(). */
  function weekdayShort(idx: number): string {
    const offset = idx === 0 ? 6 : idx - 1;
    const d = new Date(REF_MONDAY);
    d.setDate(REF_MONDAY.getDate() + offset);
    return fmtWeekdayShort.format(d);
  }

  const monthName = fmtMonthLong.format(new Date(year, month, 1));

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 pt-28 pb-24 sm:px-12">
      <header className="mb-8">
        <p className="text-amethyst-300 text-sm tracking-[4px] uppercase">
          {t("roles.productor")}
        </p>
        <h1 className="font-narrow mt-3 text-4xl font-bold uppercase sm:text-6xl">
          {t("availability.title")}
        </h1>
        <p className="text-silver-300 mt-3">{t("availability.intro")}</p>
      </header>

      {loaded && !defined && (
        <div className="mb-6 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {t.rich("availability.notDefined", {
            strong: (chunks) => <strong>{chunks}</strong>,
            month: monthName,
            year,
          })}
        </div>
      )}

      {/* Sede */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {sedes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSedeId(s.id)}
            data-active={sedeId === s.id}
            className="data-[active=true]:border-amethyst-400/60 data-[active=true]:bg-amethyst-500/10 rounded-xl border border-white/10 px-5 py-3 text-left transition hover:border-white/30"
          >
            <span className="font-narrow block text-xl font-bold uppercase">
              {s.nombre}
            </span>
            <span className="text-silver-400 text-xs">{s.ciudad}</span>
          </button>
        ))}
      </div>

      {/* Navegación de mes */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label={t("availability.prevMonth")}
          className="text-silver-200 hover:border-amethyst-300 flex size-10 items-center justify-center rounded-full border border-white/15 transition hover:text-white"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <span className="font-narrow text-2xl font-bold uppercase">
          {monthName} {year}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label={t("availability.nextMonth")}
          className="text-silver-200 hover:border-amethyst-300 flex size-10 items-center justify-center rounded-full border border-white/15 transition hover:text-white"
        >
          <ArrowLeftIcon className="size-4 rotate-180" />
        </button>
      </div>

      {/* Plantilla semanal */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-narrow text-xl font-bold text-white uppercase">
            {t("availability.weeklySchedule")}
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPlantilla(plantillaPorDefecto())}
          >
            {t("availability.applyDefault")}
          </Button>
        </div>

        <div className="flex flex-col divide-y divide-white/5">
          {WEEKDAY_INDICES.map((idx) => {
            const v = plantilla[idx];
            const trabaja = v != null;
            return (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-3 py-2.5"
              >
                <div className="w-32">
                  <Checkbox
                    checked={trabaja}
                    onChange={(on) =>
                      setPlantilla((p) => ({
                        ...p,
                        [idx]: on ? DEFAULT_VENTANA : null,
                      }))
                    }
                    label={weekdayLong(idx)}
                  />
                </div>
                {trabaja ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <TimePicker
                      value={v.desde}
                      onChange={(tp) =>
                        setPlantilla((p) => ({
                          ...p,
                          [idx]: { ...(p[idx] as VentanaHoraria), desde: tp },
                        }))
                      }
                    />
                    <span className="text-silver-400">–</span>
                    <TimePicker
                      value={v.hasta}
                      onChange={(tp) =>
                        setPlantilla((p) => ({
                          ...p,
                          [idx]: { ...(p[idx] as VentanaHoraria), hasta: tp },
                        }))
                      }
                    />
                    <span className="text-silver-400 text-xs">
                      {slotsDeVentana(v).length} slots
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => copiarADias(v)}
                      title={t("availability.applyToAllDays")}
                      aria-label={t("availability.applyToAllDays")}
                    >
                      <CopyIcon className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-silver-500 text-sm">
                    {t("availability.free")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Excepciones por día */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <h2 className="font-narrow mb-1 text-xl font-bold text-white uppercase">
          {t("availability.monthDays")}
        </h2>
        <p className="text-silver-400 mb-4 text-sm">
          {t("availability.monthDaysHint")}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_INDICES.map((idx) => (
            <span
              key={idx}
              className="text-silver-500 py-2 text-xs tracking-wide uppercase"
            >
              {weekdayShort(idx)}
            </span>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <span key={`e-${i}`} />;
            const fecha = fechaStr(year, month, day);
            const weekday = new Date(year, month, day).getDay();
            const trabaja = ventana(fecha, weekday) != null;
            return (
              <button
                key={fecha}
                type="button"
                onClick={() => toggleDia(fecha, weekday)}
                data-on={trabaja}
                className="data-[on=true]:border-amethyst-400/50 data-[on=true]:bg-amethyst-500/15 data-[on=false]:text-silver-500/50 aspect-square rounded-lg border border-transparent text-sm transition hover:border-white/20 data-[on=true]:text-white"
              >
                {day}
              </button>
            );
          })}
        </div>
      </section>

      {msg && (
        <p className="border-amethyst-300/30 bg-amethyst-500/10 text-amethyst-100 mt-6 rounded-lg border px-3 py-2 text-sm">
          {msg}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button onClick={guardar} loading={busy}>
          {t("availability.save", { month: monthName })}
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-silver-400 text-sm">
            {t("availability.advance")}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copiarFuturos(2)}
            loading={busy}
          >
            {t("availability.nextMonths", { count: 2 })}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copiarFuturos(3)}
            loading={busy}
          >
            {t("availability.nextMonths", { count: 3 })}
          </Button>
        </div>
      </div>
    </main>
  );
}
