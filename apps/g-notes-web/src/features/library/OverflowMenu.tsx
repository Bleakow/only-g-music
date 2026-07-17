"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { glassSurfaceMenu } from "@only-g/ui";
import { CHIP_BTN } from "@/components/ui";
import { SECTIONS } from "@/features/editor/sections";
import type { Library, Song } from "@/features/library/types";

/**
 * Menú «···» de la canción: lo secundario que no vive en la tira de metadatos.
 * Insertar sección, listas (many-to-many), compartir y eliminar. Portal a <body>
 * con position:fixed INLINE (glassSurfaceMenu trae `relative`, que ganaría a un
 * `fixed` por clase — ver memoria glass-popover-trap).
 */
export function OverflowMenu({
  song,
  library,
  fontId,
  fonts,
  onChooseFont,
  onInsertSection,
  onToggleList,
  onCreateList,
  onShare,
  onDelete,
}: {
  song: Song;
  library: Library;
  fontId: string;
  fonts: { id: string; label: string }[];
  onChooseFont: (id: string) => void;
  onInsertSection: (name: string) => void;
  onToggleList: (listId: string) => void;
  onCreateList: (name: string) => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [newList, setNewList] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function submitList(e: FormEvent) {
    e.preventDefault();
    const name = newList.trim();
    if (!name) return;
    onCreateList(name);
    setNewList("");
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={CHIP_BTN}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Más opciones"
      >
        <span className="leading-none tracking-widest">···</span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className={`${glassSurfaceMenu} z-80 w-64 rounded-xl p-3`}
            role="menu"
          >
            {/* Insertar sección */}
            <p className="mb-1.5 text-[0.65rem] uppercase tracking-[0.15em] text-silver-500">
              Insertar sección
            </p>
            <div className="flex flex-wrap gap-1">
              {SECTIONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onInsertSection(name);
                    setOpen(false);
                  }}
                  className="rounded-md border border-silver-200/10 px-2 py-0.5 text-[0.7rem] text-silver-400 transition hover:border-amethyst-500/40 hover:text-amethyst-300"
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="my-3 h-px bg-silver-200/10" />

            {/* Listas (many-to-many) */}
            <p className="mb-1.5 text-[0.65rem] uppercase tracking-[0.15em] text-silver-500">
              Listas
            </p>
            {library.lists.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {library.lists.map((l) => {
                  const on = song.listIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => onToggleList(l.id)}
                      className={`rounded-full border px-2.5 py-0.5 text-[0.7rem] transition ${
                        on
                          ? "border-amethyst-400/50 bg-amethyst-500/12 text-amethyst-200"
                          : "border-silver-200/10 text-silver-400 hover:border-silver-200/25"
                      }`}
                    >
                      {l.name || "Sin nombre"}
                    </button>
                  );
                })}
              </div>
            )}
            <form onSubmit={submitList}>
              <input
                value={newList}
                onChange={(e) => setNewList(e.target.value)}
                placeholder="＋ Nueva lista…"
                aria-label="Crear lista"
                className="w-full rounded-lg border border-silver-200/10 bg-white/3 px-2.5 py-1.5 text-xs text-silver-100 outline-none transition placeholder:text-silver-500 focus-visible:ring-2 focus-visible:ring-amethyst-300/70"
              />
            </form>

            {/* Fuente de la letra — solo en móvil (en escritorio vive en el footer). */}
            <div className="md:hidden">
              <div className="my-3 h-px bg-silver-200/10" />
              <p className="mb-1.5 text-[0.65rem] uppercase tracking-[0.15em] text-silver-500">
                Fuente de la letra
              </p>
              <div className="flex flex-wrap gap-1">
                {fonts.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onChooseFont(f.id)}
                    className={`rounded-full border px-2.5 py-0.5 text-[0.7rem] transition ${
                      f.id === fontId
                        ? "border-amethyst-400/50 bg-amethyst-500/12 text-amethyst-200"
                        : "border-silver-200/10 text-silver-400 hover:border-silver-200/25"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="my-3 h-px bg-silver-200/10" />

            <button
              type="button"
              onClick={() => {
                onShare();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-silver-200 transition hover:bg-silver-200/5"
              role="menuitem"
            >
              <span aria-hidden>↗</span> Compartir la letra
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
              role="menuitem"
            >
              <span aria-hidden>✕</span> Eliminar canción
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
