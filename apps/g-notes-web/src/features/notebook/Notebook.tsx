"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LyricsEditor,
  type LyricsEditorHandle,
  type EditorSelection,
} from "@/features/editor/LyricsEditor";
import { ContextPanel } from "@/features/editor/ContextPanel";
import { SECTIONS } from "@/features/editor/sections";
import {
  countLines,
  countWords,
  lineSyllables,
} from "@/features/notebook/syllables";
import { analyzeSong } from "@/features/analysis/metrics";
import {
  GENRES,
  type Genre,
  type Library,
  type Song,
} from "@/features/library/types";
import {
  loadLibrary,
  newSong,
  persistLibrary,
} from "@/features/library/storage";
import { Button, SearchableSelect, type SelectOption } from "@only-g/ui";
import { AI_MODELS, DEFAULT_MODEL } from "@only-g/ai-services";
import { loadModel, setModel } from "@/features/ai/model-store";

type SaveState = "idle" | "saving" | "saved";
const AUTOSAVE_MS = 900;

const GENRE_OPTIONS: SelectOption[] = GENRES.map((g) => ({
  value: g,
  label: g,
}));
const MODEL_OPTIONS: SelectOption[] = AI_MODELS.map((m) => ({
  value: m.id,
  label: m.label,
}));

export function Notebook() {
  const [lib, setLib] = useState<Library>({ songs: [], activeId: null });
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const [model, setModelState] = useState(DEFAULT_MODEL);

  const editorRef = useRef<LyricsEditorHandle>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef("");

  useEffect(() => {
    const loaded = loadLibrary();
    setLib(loaded);
    savedRef.current = JSON.stringify(loaded);
    setModelState(loadModel());
    setHydrated(true);
  }, []);

  function chooseModel(id: string) {
    setModel(id);
    setModelState(id);
  }

  // Autosave con debounce.
  useEffect(() => {
    if (!hydrated) return;
    const snapshot = JSON.stringify(lib);
    if (snapshot === savedRef.current) return;
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      persistLibrary(lib);
      savedRef.current = snapshot;
      setSaveState("saved");
    }, AUTOSAVE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lib, hydrated]);

  const active = useMemo(
    () => lib.songs.find((s) => s.id === lib.activeId) ?? null,
    [lib],
  );

  const stats = useMemo(() => {
    const body = active?.body ?? "";
    return {
      lines: countLines(body),
      words: countWords(body),
      syllables: body
        .split("\n")
        .reduce((total, line) => total + lineSyllables(line), 0),
      analysis: analyzeSong(body),
    };
  }, [active]);

  function patchActive(patch: Partial<Song>) {
    setLib((prev) => ({
      ...prev,
      songs: prev.songs.map((s) =>
        s.id === prev.activeId ? { ...s, ...patch, updatedAt: Date.now() } : s,
      ),
    }));
  }

  function createSong() {
    const song = newSong();
    setLib((prev) => ({ songs: [song, ...prev.songs], activeId: song.id }));
    setSidebarOpen(false);
    requestAnimationFrame(() => editorRef.current?.focus());
  }

  function selectSong(id: string) {
    setLib((prev) => ({ ...prev, activeId: id }));
    setSidebarOpen(false);
  }

  function deleteSong(id: string) {
    setLib((prev) => {
      const songs = prev.songs.filter((s) => s.id !== id);
      if (songs.length === 0) {
        const fresh = newSong();
        return { songs: [fresh], activeId: fresh.id };
      }
      const activeId =
        prev.activeId === id ? songs[0].id : prev.activeId;
      return { songs, activeId };
    });
  }

  return (
    <div className="flex min-h-dvh">
      {/* ── Sidebar / biblioteca ─────────────────────────────── */}
      <aside
        className={`glass fixed inset-y-0 left-0 z-20 flex w-72 flex-col gap-3 p-4 transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-1">
          <h1 className="bg-linear-to-r from-amethyst-300 to-amethyst-500 bg-clip-text text-lg font-bold tracking-tight text-transparent">
            G&nbsp;Notes
          </h1>
          <Button size="sm" variant="outline" onClick={createSong}>
            + Nueva
          </Button>
        </div>
        <p className="px-1 text-[0.7rem] uppercase tracking-wide text-silver-500">
          Biblioteca
        </p>
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {lib.songs.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => selectSong(s.id)}
                className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  s.id === lib.activeId
                    ? "bg-amethyst-500/20 text-silver-50"
                    : "text-silver-300 hover:bg-silver-200/5"
                }`}
              >
                <span className="flex-1 truncate">
                  {s.title.trim() || "Sin título"}
                </span>
                {s.genre && (
                  <span className="shrink-0 rounded bg-ink/40 px-1.5 py-0.5 text-[0.6rem] text-amethyst-300">
                    {s.genre}
                  </span>
                )}
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`¿Eliminar "${s.title.trim() || "Sin título"}"?`))
                      deleteSong(s.id);
                  }}
                  className="shrink-0 text-silver-500 opacity-0 transition hover:text-danger group-hover:opacity-100"
                  aria-label="Eliminar"
                >
                  ✕
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-silver-200/10 pt-3">
          <p className="mb-1.5 px-1 text-[0.7rem] uppercase tracking-wide text-silver-500">
            Modelo de IA
          </p>
          <SearchableSelect
            value={model}
            onChange={chooseModel}
            options={MODEL_OPTIONS}
            ariaLabel="Modelo de IA"
            searchPlaceholder="Buscar modelo…"
            emptyText="Sin modelos"
            allowCustom
            customLabel={(t) => `Usar "${t}"`}
            placement="top"
          />
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-ink/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Editor ───────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 px-4 py-3 md:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-silver-200/10 p-1.5 text-silver-300 md:hidden"
            aria-label="Abrir biblioteca"
          >
            ☰
          </button>
          <input
            value={active?.title ?? ""}
            onChange={(e) => patchActive({ title: e.target.value })}
            placeholder="Título de la canción…"
            aria-label="Título"
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-silver-50 outline-none placeholder:text-silver-500"
          />
          <div className="w-32 shrink-0">
            <SearchableSelect
              value={active?.genre ?? ""}
              onChange={(g) => patchActive({ genre: g as Genre })}
              options={GENRE_OPTIONS}
              placeholder="Género…"
              ariaLabel="Género"
              searchPlaceholder="Buscar…"
              emptyText="Sin resultados"
              className="flex min-h-9 w-full items-center justify-between gap-1 rounded-lg border border-silver-200/10 bg-ink-panel px-2.5 py-1.5 text-left text-xs text-silver-200 outline-none transition hover:border-silver-200/25 focus-visible:ring-2 focus-visible:ring-amethyst-300/70"
            />
          </div>
          <SaveIndicator state={saveState} hydrated={hydrated} />
        </div>

        {/* Toolbar de secciones */}
        <div className="flex flex-wrap gap-1.5 px-4 pb-2 md:px-8">
          {SECTIONS.map((name) => (
            <button
              key={name}
              onClick={() => editorRef.current?.insertSection(name)}
              className="rounded-md border border-silver-200/10 px-2 py-0.5 text-[0.7rem] text-silver-400 transition hover:border-amethyst-500/40 hover:text-amethyst-300"
            >
              {name}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 px-1 md:px-5">
          {hydrated && active && (
            <LyricsEditor
              key={active.id}
              ref={editorRef}
              value={active.body}
              onChange={(body) => patchActive({ body })}
              onSelection={setSelection}
            />
          )}
        </div>

        <ContextPanel
          selection={selection}
          genre={active?.genre || undefined}
          context={active?.body}
          onApply={(from, to, text) => {
            editorRef.current?.replaceRange(from, to, text);
            setSelection(null);
          }}
          onClose={() => setSelection(null)}
        />

        <div className="flex items-center justify-between border-t border-silver-200/10 px-4 py-2 text-xs text-silver-500 md:px-8">
          <span className="tabular-nums">
            {stats.lines} versos · {stats.words} palabras ·{" "}
            <span className="text-amethyst-300">{stats.syllables}</span> sílabas
          </span>
          {stats.analysis.dominant > 0 && stats.analysis.verseCount > 2 ? (
            <span className="tabular-nums">
              Métrica:{" "}
              <span className="text-amethyst-300">{stats.analysis.name}</span> (
              {stats.analysis.dominant}) · {stats.analysis.consistencyPct}%
              consistencia
            </span>
          ) : (
            <span className="text-silver-500">
              sílabas métricas por verso a la izquierda
            </span>
          )}
        </div>
      </main>
    </div>
  );
}

function SaveIndicator({
  state,
  hydrated,
}: {
  state: SaveState;
  hydrated: boolean;
}) {
  if (!hydrated) return null;
  const label =
    state === "saving" ? "Guardando…" : state === "saved" ? "Guardado" : "Local";
  return (
    <div className="hidden items-center gap-1.5 text-xs text-silver-400 sm:flex">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          state === "saving" ? "animate-pulse bg-warning" : "bg-amethyst-400"
        }`}
        aria-hidden
      />
      {label}
    </div>
  );
}
