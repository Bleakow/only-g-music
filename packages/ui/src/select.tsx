"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { glassSurfaceMenu } from "./glass";
import { CheckIcon, SpinnerIcon } from "./icons";

export interface SelectOption {
  value: string;
  label: string;
}

interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

/**
 * Combobox buscable reutilizable (escribe → filtra → selecciona). Estilo Glass,
 * navegable con teclado (↑/↓/Enter/Esc) y táctil. Menú portalizado a <body>.
 * Compartido entre only-g-web y g-notes-web.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "",
  searchPlaceholder = "",
  emptyText = "",
  customLabel,
  allowCustom = false,
  disabled = false,
  loading = false,
  placement = "bottom",
  ariaLabel,
  className = "",
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  customLabel?: (typed: string) => string;
  allowCustom?: boolean;
  disabled?: boolean;
  loading?: boolean;
  placement?: "top" | "bottom";
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? value;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => setMounted(true), []);

  const computePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    const width = Math.max(r.width, 224);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setMenuPos(
      placement === "top"
        ? { left, width, bottom: window.innerHeight - r.top + gap }
        : { left, width, top: r.bottom + gap },
    );
  }, [placement]);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    computePosition();
    const onReflow = () => computePosition();
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      const inRoot = rootRef.current?.contains(target);
      const inMenu = menuRef.current?.contains(target);
      if (!inRoot && !inMenu) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const typed = query.trim();
  const showCustom =
    allowCustom &&
    typed.length > 0 &&
    !filtered.some((o) => o.label.toLowerCase() === typed.toLowerCase());

  function choose(opt: SelectOption) {
    onChange(opt.value);
    setOpen(false);
  }

  function commitCustom() {
    if (!typed) return;
    onChange(typed);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
      else if (showCustom) commitCustom();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={
          className ||
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg bg-white/6 px-3 py-2 text-left text-white ring-1 ring-white/20 ring-inset transition hover:ring-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amethyst-300/70 disabled:opacity-50"
        }
        style={style}
      >
        <span className={display ? "truncate" : "truncate opacity-50"}>
          {display || placeholder}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`size-4 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        mounted &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: menuPos.left,
              top: menuPos.top,
              bottom: menuPos.bottom,
              width: menuPos.width,
            }}
            className={`${glassSurfaceMenu} z-[90] rounded-xl p-2`}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg bg-black/30 px-3 py-2 text-base text-white ring-1 ring-white/15 ring-inset transition placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amethyst-300/70"
            />

            <ul role="listbox" className="mt-2 max-h-60 overflow-auto">
              {loading ? (
                <li className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-white/60">
                  <SpinnerIcon className="size-4 animate-spin" />
                </li>
              ) : filtered.length === 0 && !showCustom ? (
                <li className="px-3 py-4 text-center text-sm text-white/45">
                  {emptyText}
                </li>
              ) : (
                <>
                  {filtered.map((o, i) => (
                    <li
                      key={o.value}
                      role="option"
                      aria-selected={o.value === value}
                    >
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => choose(o)}
                        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                          i === active
                            ? "bg-white/10 text-white"
                            : "text-white/80"
                        }`}
                      >
                        <span className="truncate">{o.label}</span>
                        {o.value === value && (
                          <CheckIcon className="text-amethyst-300 size-4 shrink-0" />
                        )}
                      </button>
                    </li>
                  ))}
                  {showCustom && (
                    <li>
                      <button
                        type="button"
                        onClick={commitCustom}
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                      >
                        {customLabel ? customLabel(typed) : `"${typed}"`}
                      </button>
                    </li>
                  )}
                </>
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
