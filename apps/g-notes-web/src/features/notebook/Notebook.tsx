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
  SONG_TEMPLATES,
  getTemplate,
  suggestedTemplateId,
} from "@/features/editor/templates";
import {
  countLines,
  countWords,
  lineSyllables,
} from "@/features/notebook/syllables";
import { analyzeSong } from "@/features/analysis/metrics";
import {
  type Library,
  type ReleaseKind,
  type Song,
} from "@/features/library/types";
import {
  loadLibrary,
  newList,
  newRelease,
  newSong,
  persistLibrary,
} from "@/features/library/storage";
import { LibraryList } from "@/features/library/LibraryList";
import { SongMeta } from "@/features/library/SongMeta";
import { type GroupBy } from "@/features/library/organize";
import {
  loadCloudLibrary,
  mergeLibraries,
  saveCloudLibrary,
} from "@/features/library/sync";
import { Button, SearchableSelect, type SelectOption } from "@only-g/ui";
import { AI_MODELS, DEFAULT_MODEL } from "@only-g/ai-services";
import { loadModel, setModel } from "@/features/ai/model-store";
import { useAuth } from "@/features/auth/AuthProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreateReleaseDialog } from "@/components/CreateReleaseDialog";
import { COMPACT_SELECT } from "@/components/ui";

type SaveState = "idle" | "saving" | "saved";
const AUTOSAVE_MS = 900;

const MODEL_OPTIONS: SelectOption[] = AI_MODELS.map((m) => ({
  value: m.id,
  label: m.label,
}));

export function Notebook() {
  const [lib, setLib] = useState<Library>({
    songs: [],
    releases: [],
    lists: [],
    activeId: null,
  });
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const [model, setModelState] = useState(DEFAULT_MODEL);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [showNewRelease, setShowNewRelease] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const { user } = useAuth();

  const editorRef = useRef<LyricsEditorHandle>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef("");
  // Espejo siempre-al-día de `lib` para usar dentro de efectos async (el merge).
  const libRef = useRef(lib);
  libRef.current = lib;

  // Carga local instantánea (offline-first): escribir de inmediato, sin esperar red.
  useEffect(() => {
    const loaded = loadLibrary();
    setLib(loaded);
    savedRef.current = JSON.stringify(loaded);
    setModelState(loadModel());
    setHydrated(true);
  }, []);

  // Sync con la nube al tener sesión: une local + Firestore (sin perder trabajo de
  // ninguno) y sube el resultado. Una sola carga al entrar (sin subscripción viva).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await loadCloudLibrary(user.uid);
        if (cancelled) return;
        // Merge si hay nube; si está vacía, se sube el local (siembra la nube con
        // el trabajo de usuarios que hasta ahora solo escribían en localStorage).
        const merged = cloud ? mergeLibraries(libRef.current, cloud) : libRef.current;
        if (cloud) {
          setLib(merged);
          persistLibrary(merged);
          savedRef.current = JSON.stringify(merged);
        }
        void saveCloudLibrary(user.uid, merged);
      } catch (err) {
        // Sin nube (offline / reglas): seguimos en local, no rompemos la escritura.
        console.error("gnotes sync:", err);
      } finally {
        if (!cancelled) setCloudReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function chooseModel(id: string) {
    setModel(id);
    setModelState(id);
  }

  // Autosave con debounce: siempre a localStorage (instantáneo, offline) y, tras el
  // merge inicial (cloudReady), también a Firestore. El gate cloudReady evita pisar
  // la nube antes de haberla unido con lo local.
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
      if (user && cloudReady) {
        void saveCloudLibrary(user.uid, lib).catch((err) =>
          console.error("gnotes cloud save:", err),
        );
      }
    }, AUTOSAVE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lib, hydrated, user, cloudReady]);

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

  // Plantillas: la sugerida para el género activo va primero y marcada.
  const templateOptions = useMemo<SelectOption[]>(() => {
    const suggested = suggestedTemplateId(active?.genre || undefined);
    return [...SONG_TEMPLATES]
      .sort((a, b) => (a.id === suggested ? -1 : b.id === suggested ? 1 : 0))
      .map((t) => ({
        value: t.id,
        label: t.id === suggested ? `${t.name} · sugerida` : t.name,
      }));
  }, [active?.genre]);

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
    setLib((prev) => ({ ...prev, songs: [song, ...prev.songs], activeId: song.id }));
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
        return { ...prev, songs: [fresh], activeId: fresh.id };
      }
      const activeId =
        prev.activeId === id ? songs[0].id : prev.activeId;
      return { ...prev, songs, activeId };
    });
  }

  // Asigna la canción activa a un release (o la suelta). El trackNo se calcula
  // como el siguiente hueco del tracklist de ese release.
  function assignRelease(releaseId: string | null) {
    setLib((prev) => ({
      ...prev,
      songs: prev.songs.map((s) => {
        if (s.id !== prev.activeId) return s;
        const trackNo = releaseId
          ? prev.songs.reduce(
              (max, x) =>
                x.releaseId === releaseId ? Math.max(max, x.trackNo ?? 0) : max,
              0,
            ) + 1
          : null;
        return { ...s, releaseId, trackNo, updatedAt: Date.now() };
      }),
    }));
  }

  function createRelease(name: string, kind: ReleaseKind) {
    setLib((prev) => {
      const rel = newRelease(name, kind);
      return {
        ...prev,
        releases: [...prev.releases, rel],
        songs: prev.songs.map((s) =>
          s.id === prev.activeId
            ? { ...s, releaseId: rel.id, trackNo: 1, updatedAt: Date.now() }
            : s,
        ),
      };
    });
    setShowNewRelease(false);
  }

  function toggleList(listId: string) {
    setLib((prev) => ({
      ...prev,
      songs: prev.songs.map((s) => {
        if (s.id !== prev.activeId) return s;
        const has = s.listIds.includes(listId);
        return {
          ...s,
          listIds: has
            ? s.listIds.filter((x) => x !== listId)
            : [...s.listIds, listId],
          updatedAt: Date.now(),
        };
      }),
    }));
  }

  function createList(name: string) {
    setLib((prev) => {
      const list = newList(name);
      return {
        ...prev,
        lists: [...prev.lists, list],
        songs: prev.songs.map((s) =>
          s.id === prev.activeId
            ? { ...s, listIds: [...s.listIds, list.id], updatedAt: Date.now() }
            : s,
        ),
      };
    });
  }

  function applyTemplate(id: string) {
    const tpl = getTemplate(id);
    if (tpl) editorRef.current?.insertTemplate(tpl.sections);
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

        <div className="flex items-center justify-between px-1">
          <p className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-[0.15em] text-silver-500">
            <span aria-hidden>❖</span> Biblioteca
          </p>
          <span className="rounded-full bg-silver-200/6 px-2 py-0.5 text-[0.7rem] tabular-nums text-silver-400">
            {lib.songs.length}
          </span>
        </div>

        <LibraryList
          library={lib}
          activeId={lib.activeId}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          onSelect={selectSong}
          onRequestDelete={setPendingDelete}
        />

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
            className={COMPACT_SELECT}
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
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight text-silver-50 outline-none placeholder:font-normal placeholder:text-silver-500"
          />
          {/* Deshacer / rehacer: al alcance del pulgar en móvil (no hay Ctrl+Z). */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => editorRef.current?.undo()}
              className="rounded-lg border border-silver-200/10 px-2 py-1 text-base leading-none text-silver-300 transition hover:border-amethyst-500/40 hover:text-amethyst-300"
              aria-label="Deshacer"
              title="Deshacer"
            >
              ↶
            </button>
            <button
              onClick={() => editorRef.current?.redo()}
              className="rounded-lg border border-silver-200/10 px-2 py-1 text-base leading-none text-silver-300 transition hover:border-amethyst-500/40 hover:text-amethyst-300"
              aria-label="Rehacer"
              title="Rehacer"
            >
              ↷
            </button>
          </div>
          <SaveIndicator state={saveState} hydrated={hydrated} />
        </div>

        {active && (
          <SongMeta
            song={active}
            library={lib}
            onPatch={patchActive}
            onAssignRelease={assignRelease}
            onCreateRelease={() => setShowNewRelease(true)}
            onToggleList={toggleList}
            onCreateList={createList}
          />
        )}

        {/* Toolbar: plantilla de estructura + secciones sueltas (con separador) */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-silver-200/10 px-4 pb-3 md:px-8">
          <div className="w-48">
            <SearchableSelect
              value=""
              onChange={applyTemplate}
              options={templateOptions}
              placeholder="＋ Plantilla…"
              ariaLabel="Insertar plantilla de estructura"
              searchPlaceholder="Buscar plantilla…"
              emptyText="Sin plantillas"
              className={COMPACT_SELECT}
            />
          </div>
          <span className="mx-0.5 text-silver-600" aria-hidden>
            |
          </span>
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

        <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3 md:px-6">
          {/* Hoja de escritura: card de cristal que se ilumina en amatista al
              enfocar → señala "aquí se escribe". Medida cómoda (max-w-3xl). */}
          <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-silver-200/10 bg-white/1.5 transition-all duration-300 focus-within:border-amethyst-500/30 focus-within:bg-white/2.5 focus-within:shadow-[0_0_0_1px_rgba(139,92,246,0.12),0_24px_70px_-40px_rgba(139,92,246,0.55)]">
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar canción"
        message={`¿Seguro que quieres eliminar "${
          lib.songs.find((s) => s.id === pendingDelete)?.title.trim() ||
          "Sin título"
        }"? No se puede deshacer.`}
        onConfirm={() => {
          if (pendingDelete) deleteSong(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <CreateReleaseDialog
        open={showNewRelease}
        onCreate={createRelease}
        onCancel={() => setShowNewRelease(false)}
      />
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
    state === "saving"
      ? "Guardando…"
      : state === "saved"
        ? "Sincronizado"
        : "Local";
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
