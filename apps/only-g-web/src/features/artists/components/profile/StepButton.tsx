"use client";

import { useEffect, useRef } from "react";

/**
 * Botón de paso (−/+) con press-and-hold: un toque = un paso; mantener pulsado
 * repite (tras un pequeño retraso) para mover rápido sin perder el ajuste fino.
 * `onStep` usa actualización funcional, así que la repetición siempre parte del
 * último valor aunque el componente se re-renderice durante el hold.
 *
 * Compartido por el encuadre del hero y la vista previa por pantalla.
 */
export function StepButton({
  onStep,
  ariaLabel,
  children,
}: {
  onStep: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const timers = useRef<{
    delay?: ReturnType<typeof setTimeout>;
    rep?: ReturnType<typeof setInterval>;
  }>({});

  const stop = () => {
    if (timers.current.delay) clearTimeout(timers.current.delay);
    if (timers.current.rep) clearInterval(timers.current.rep);
    timers.current = {};
  };
  const start = () => {
    onStep();
    timers.current.delay = setTimeout(() => {
      timers.current.rep = setInterval(onStep, 60);
    }, 300);
  };

  useEffect(() => stop, []);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="flex size-9 touch-none items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/25 transition ring-inset hover:bg-white/20 active:scale-90"
    >
      {children}
    </button>
  );
}

export const clampNum = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));
