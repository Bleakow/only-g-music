"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { sedes } from "@/features/sedes/data/sedes";
import type { SedeId } from "@/domain/sede";
import {
  plantillaPorDefecto,
  slotsDeVentana,
  type PlantillaSemanal,
  type VentanaHoraria,
} from "@/domain/availability";
import {
  getDisponibilidadMes,
  saveDisponibilidadMes,
} from "../lib/availability-repo";
import { ArrowLeftIcon, CopyIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { TimePicker } from "@/components/ui/TimePicker";

// Orden de visualización Lun→Dom; el índice es el de Date.getDay() (0=Dom).
const WEEKDAYS = [
  { idx: 1, label: "Lunes" },
  { idx: 2, label: "Martes" },
  { idx: 3, label: "Miércoles" },
  { idx: 4, label: "Jueves" },
  { idx: 5, label: "Viernes" },
  { idx: 6, label: "Sábado" },
  { idx: 0, label: "Domingo" },
];
const WD_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DEFAULT_VENTANA: VentanaHoraria = { desde: "10:00", hasta: "16:00" };

const emptyPlantilla = (): PlantillaSemanal => ({
  0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
});

const ym = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}`;
const fechaStr = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function AvailabilityEditor() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(0);
  const [sedeId, setSedeId] = useState<SedeId>(sedes[0].id);
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
    setMsg("Horario aplicado a todos los días de la semana.");
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
      setMsg("Disponibilidad guardada.");
    } catch (e) {
      console.error("[disponibilidad] error:", e);
      setMsg(
        "No se pudo guardar. Verifica que tengas rol de productor y que las reglas estén desplegadas.",
      );
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
      setMsg(`Plantilla aplicada a los próximos ${meses} meses.`);
    } catch (e) {
      console.error("[disponibilidad] error:", e);
      setMsg("No se pudo copiar a los próximos meses.");
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

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-28 sm:px-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[4px] text-amethyst-300">
          Productor
        </p>
        <h1 className="mt-3 font-narrow text-4xl font-bold uppercase sm:text-6xl">
          Tu disponibilidad
        </h1>
        <p className="mt-3 text-silver-300">
          Define tu horario por mes. Puedes aplicar la plantilla por defecto,
          ajustar cada día de la semana y marcar días libres puntuales.
        </p>
      </header>

      {loaded && !defined && (
        <div className="mb-6 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <strong>Aún no has definido</strong> tu disponibilidad de{" "}
          {MONTHS[month]} {year}. Defínela para que los clientes puedan reservar.
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
            className="rounded-xl border border-white/10 px-5 py-3 text-left transition hover:border-white/30 data-[active=true]:border-amethyst-400/60 data-[active=true]:bg-amethyst-500/10"
          >
            <span className="block font-narrow text-xl font-bold uppercase">
              {s.nombre}
            </span>
            <span className="text-xs text-silver-400">{s.ciudad}</span>
          </button>
        ))}
      </div>

      {/* Navegación de mes */}
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

      {/* Plantilla semanal */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-narrow text-xl font-bold uppercase text-white">
            Horario semanal
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPlantilla(plantillaPorDefecto())}
          >
            Aplicar plantilla por defecto
          </Button>
        </div>

        <div className="flex flex-col divide-y divide-white/5">
          {WEEKDAYS.map(({ idx, label }) => {
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
                    label={label}
                  />
                </div>
                {trabaja ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <TimePicker
                      value={v.desde}
                      onChange={(t) =>
                        setPlantilla((p) => ({
                          ...p,
                          [idx]: { ...(p[idx] as VentanaHoraria), desde: t },
                        }))
                      }
                    />
                    <span className="text-silver-400">–</span>
                    <TimePicker
                      value={v.hasta}
                      onChange={(t) =>
                        setPlantilla((p) => ({
                          ...p,
                          [idx]: { ...(p[idx] as VentanaHoraria), hasta: t },
                        }))
                      }
                    />
                    <span className="text-xs text-silver-400">
                      {slotsDeVentana(v).length} slots
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => copiarADias(v)}
                      title="Aplicar este horario a todos los días"
                      aria-label="Aplicar este horario a todos los días"
                    >
                      <CopyIcon className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-silver-500">Libre</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Excepciones por día */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <h2 className="mb-1 font-narrow text-xl font-bold uppercase text-white">
          Días del mes
        </h2>
        <p className="mb-4 text-sm text-silver-400">
          Toca un día para marcarlo libre o disponible (excepción puntual sobre
          el horario semanal).
        </p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WD_SHORT.map((w) => (
            <span
              key={w}
              className="py-2 text-xs uppercase tracking-wide text-silver-500"
            >
              {w}
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
                className="aspect-square rounded-lg border border-transparent text-sm transition data-[on=true]:border-amethyst-400/50 data-[on=true]:bg-amethyst-500/15 data-[on=true]:text-white data-[on=false]:text-silver-500/50 hover:border-white/20"
              >
                {day}
              </button>
            );
          })}
        </div>
      </section>

      {msg && (
        <p className="mt-6 rounded-lg border border-amethyst-300/30 bg-amethyst-500/10 px-3 py-2 text-sm text-amethyst-100">
          {msg}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button onClick={guardar} loading={busy}>
          {`Guardar ${MONTHS[month]}`}
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-silver-400">Adelantar:</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copiarFuturos(2)}
            loading={busy}
          >
            Próximos 2 meses
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copiarFuturos(3)}
            loading={busy}
          >
            Próximos 3 meses
          </Button>
        </div>
      </div>
    </main>
  );
}
