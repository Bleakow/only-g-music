"use client";

import { useEffect, useRef, useState } from "react";
import { ClockIcon } from "@/components/icons";

/** "HH:mm" (24h, formato de almacenamiento) → "h:mm AM/PM" (para mostrar). */
function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function genTimes(min: string, max: string, stepMin: number): string[] {
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const toHHMM = (t: number) =>
    `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  const out: string[] = [];
  for (let t = toMin(min); t <= toMin(max); t += stepMin) out.push(toHHMM(t));
  return out;
}

/**
 * Selector de hora desplegable. Al hacer clic en cualquier parte del control se
 * expande y muestra las horas seleccionables (cada `stepMin`). Reutilizable.
 */
export function TimePicker({
  value,
  onChange,
  min = "06:00",
  max = "23:00",
  stepMin = 30,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  stepMin?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = genTimes(min, max, stepMin);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm tabular-nums text-silver-50 transition hover:border-amethyst-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amethyst-300/70"
      >
        <ClockIcon className="size-4 text-silver-400" />
        {to12h(value)}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-32 overflow-y-auto rounded-lg border border-white/10 bg-ink-soft p-1 shadow-2xl"
        >
          {options.map((t) => (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={t === value}
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              data-active={t === value}
              className="block w-full rounded-md px-3 py-1.5 text-left text-sm tabular-nums text-silver-100 transition hover:bg-white/5 data-[active=true]:bg-amethyst-500/20 data-[active=true]:text-white"
            >
              {to12h(t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
