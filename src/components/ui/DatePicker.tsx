"use client";

import { useCallback, useEffect, useRef, useState, type SVGProps } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftIcon } from "@/components/icons";
import { glassSurfaceMenu, GlassSheen } from "@/components/ui/glass";

function CalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  );
}

function parseYMD(s?: string): { y: number; m: number; d: number } | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
}
const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const DEFAULT_TRIGGER =
  "w-full rounded-lg bg-white/[0.06] px-3.5 py-2.5 text-white ring-1 ring-inset ring-white/20 transition focus:ring-white/50";
const SELECTED =
  "data-[selected=true]:bg-gradient-to-br data-[selected=true]:from-silver-100 data-[selected=true]:to-amethyst-300 data-[selected=true]:font-bold data-[selected=true]:text-ink";
const POP_W = 300;
const POP_H = 356;

/**
 * Selector de fecha propio (reemplaza `<input type="date">`, feo e inconsistente
 * entre navegadores): un disparador con pinta de input + un popover de CRISTAL con
 * calendario. Navegación en 3 niveles (día → mes → año) para llegar rápido a
 * fechas lejanas (p. ej. nacimiento). El popover va por portal a <body> y se ancla
 * al disparador (sin recortes dentro de modales con scroll). Valor "YYYY-MM-DD"
 * (drop-in del input nativo).
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder,
  className,
  disabled,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("datePicker");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [cy, setCy] = useState(
    () => parseYMD(value)?.y ?? new Date().getFullYear(),
  );
  const [cm, setCm] = useState(
    () => parseYMD(value)?.m ?? new Date().getMonth(),
  );
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const top =
      below >= POP_H + 8 || below >= r.top ? r.bottom + 6 : r.top - POP_H - 6;
    let left = r.left;
    if (left + POP_W > window.innerWidth - 8)
      left = window.innerWidth - POP_W - 8;
    setPos({ top: Math.max(8, top), left: Math.max(8, left) });
  }, []);

  function openPicker() {
    if (disabled) return;
    const p = parseYMD(value);
    setCy(p?.y ?? new Date().getFullYear());
    setCm(p?.m ?? new Date().getMonth());
    setView("days");
    place();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (popRef.current?.contains(n) || triggerRef.current?.contains(n))
        return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const sel = parseYMD(value);
  const now = new Date();
  const [todayY, todayM, todayD] = [
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ];

  const minD = parseYMD(min);
  const maxD = parseYMD(max);
  const outOfRange = (y: number, m: number, d: number) => {
    const v = y * 10000 + m * 100 + d;
    if (minD && v < minD.y * 10000 + minD.m * 100 + minD.d) return true;
    if (maxD && v > maxD.y * 10000 + maxD.m * 100 + maxD.d) return true;
    return false;
  };

  function choose(y: number, m: number, d: number) {
    onChange(ymd(y, m, d));
    setOpen(false);
  }

  const display = sel
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(sel.y, sel.m, sel.d))
    : (placeholder ?? t("placeholder"));

  // Encabezados de día (lunes primero: 2024-01-01 fue lunes).
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(
      new Date(2024, 0, 1 + i),
    ),
  );
  const monthsShort = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(
      new Date(2024, i),
    ),
  );
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(cy, cm));

  const firstWeekday = (new Date(cy, cm, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(cy, cm + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shiftMonth = (delta: number) => {
    let m = cm + delta;
    let y = cy;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    setCm(m);
    setCy(y);
  };

  const yearStart = Math.floor(cy / 12) * 12;
  const navBtn =
    "text-silver-200 flex size-8 items-center justify-center rounded-lg transition hover:bg-white/10 hover:text-white";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-label={t("open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex items-center justify-between gap-2 text-left disabled:opacity-50 ${
          className ?? DEFAULT_TRIGGER
        }`}
      >
        <span className={sel ? "" : "text-white/40"}>{display}</span>
        <CalIcon className="size-4 shrink-0 text-white/50" />
      </button>

      {mounted &&
        open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            // `position: fixed` en estilo inline a propósito: `glassSurfaceMenu`
            // trae `relative`, y la clase Tailwind `fixed` perdería contra ella
            // (orden de utilidades), dejando el popover fuera de vista dentro de
            // un modal. Inline gana a la clase.
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: POP_W,
            }}
            className={`${glassSurfaceMenu} z-[130] overflow-hidden rounded-2xl p-3`}
          >
            <GlassSheen />
            <div className="relative">
              {/* Cabecera con navegación */}
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label={t("prev")}
                  onClick={() =>
                    view === "days"
                      ? shiftMonth(-1)
                      : view === "months"
                        ? setCy(cy - 1)
                        : setCy(cy - 12)
                  }
                  className={navBtn}
                >
                  <ArrowLeftIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setView(
                      view === "days"
                        ? "months"
                        : view === "months"
                          ? "years"
                          : "days",
                    )
                  }
                  className="font-narrow rounded-lg px-3 py-1 text-sm font-bold tracking-wide text-white uppercase transition hover:bg-white/10"
                >
                  {view === "days"
                    ? monthLabel
                    : view === "months"
                      ? cy
                      : `${yearStart} – ${yearStart + 11}`}
                </button>
                <button
                  type="button"
                  aria-label={t("next")}
                  onClick={() =>
                    view === "days"
                      ? shiftMonth(1)
                      : view === "months"
                        ? setCy(cy + 1)
                        : setCy(cy + 12)
                  }
                  className={navBtn}
                >
                  <ArrowLeftIcon className="size-4 rotate-180" />
                </button>
              </div>

              {view === "days" && (
                <>
                  <div className="grid grid-cols-7 text-center">
                    {weekdays.map((w, i) => (
                      <span
                        key={i}
                        className="text-silver-500 py-1 text-[0.7rem] uppercase"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {cells.map((d, i) => {
                      if (d === null) return <span key={`e-${i}`} />;
                      const isSel =
                        !!sel && sel.y === cy && sel.m === cm && sel.d === d;
                      const isToday =
                        cy === todayY && cm === todayM && d === todayD;
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={outOfRange(cy, cm, d)}
                          onClick={() => choose(cy, cm, d)}
                          data-selected={isSel}
                          className={`relative aspect-square rounded-lg text-sm transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/20 ${SELECTED} ${
                            isSel ? "" : "text-silver-100"
                          }`}
                        >
                          {d}
                          {isToday && !isSel && (
                            <span className="bg-amethyst-300 absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => choose(todayY, todayM, todayD)}
                    className="text-amethyst-200 mt-2 w-full rounded-lg py-1.5 text-xs font-semibold tracking-wide uppercase transition hover:bg-white/10 hover:text-white"
                  >
                    {t("today")}
                  </button>
                </>
              )}

              {view === "months" && (
                <div className="grid grid-cols-3 gap-1.5">
                  {monthsShort.map((mn, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCm(i);
                        setView("days");
                      }}
                      data-selected={!!sel && sel.y === cy && sel.m === i}
                      className={`text-silver-100 rounded-lg py-2.5 text-sm capitalize transition hover:bg-white/10 ${SELECTED}`}
                    >
                      {mn}
                    </button>
                  ))}
                </div>
              )}

              {view === "years" && (
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => yearStart + i).map(
                    (y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => {
                          setCy(y);
                          setView("months");
                        }}
                        data-selected={!!sel && sel.y === y}
                        className={`text-silver-100 rounded-lg py-2.5 text-sm tabular-nums transition hover:bg-white/10 ${SELECTED}`}
                      >
                        {y}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
