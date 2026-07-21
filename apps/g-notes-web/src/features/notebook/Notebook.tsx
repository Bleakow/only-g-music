"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LyricsEditor,
  type LyricsEditorHandle,
  type EditorSelection,
} from "@/features/editor/LyricsEditor";
import { ContextPanel } from "@/features/editor/ContextPanel";
import { SectionPalette } from "@/features/editor/SectionPalette";
import { getTemplate } from "@/features/editor/templates";
import { ShareIcon } from "@/components/icons";
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
import { OverflowMenu } from "@/features/library/OverflowMenu";
import { type GroupBy } from "@/features/library/organize";
import {
  loadCloudLibrary,
  mergeLibraries,
  saveCloudLibrary,
} from "@/features/library/sync";
import {
  SearchableSelect,
  glassSurfaceSoft,
  type SelectOption,
} from "@only-g/ui";
import { AI_MODELS, DEFAULT_MODEL } from "@only-g/ai-services";
import { loadModel, setModel } from "@/features/ai/model-store";
import { AiQuotaStatus } from "@/features/ai/AiQuotaStatus";
import {
  DEFAULT_FONT,
  LYRIC_FONTS,
  fontStack,
  loadFont,
  setFont,
} from "@/features/editor/fonts";
import { useAuth } from "@/features/auth/AuthProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreateReleaseDialog } from "@/components/CreateReleaseDialog";
import { ShareDialog } from "@/components/ShareDialog";
import { COMPACT_SELECT } from "@/components/ui";

type SaveState = "idle" | "saving" | "saved";
const AUTOSAVE_MS = 900;

const MODEL_OPTIONS: SelectOption[] = AI_MODELS.map((m) => ({
  value: m.id,
  label: m.label,
}));
const FONT_OPTIONS: SelectOption[] = LYRIC_FONTS.map((f) => ({
  value: f.id,
  label: f.label,
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
  const [lyricFont, setLyricFontState] = useState(DEFAULT_FONT);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [showNewRelease, setShowNewRelease] = useState(false);
  const [showShare, setShowShare] = useState(false);
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
    setLyricFontState(loadFont());
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

  function chooseFont(id: string) {
    setFont(id);
    setLyricFontState(id);
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

  // Compartir la letra: abre el lienzo con marca (imagen descargable / copiar).
  function shareSong() {
    if (active) setShowShare(true);
  }

  return (
    // h-dvh (no min-h): altura FIJA al viewport → el editor y el sidebar hacen
    // scroll INTERNO en vez de empujar/estirar el layout con textos largos.
    <div className="flex h-dvh overflow-hidden">
      {/* ── Sidebar / biblioteca ─────────────────────────────── */}
      <aside
        className={`glass fixed inset-y-0 left-0 z-20 flex w-72 flex-col gap-3 p-4 transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-1">
          <h1 className="text-[0.8rem] font-bold uppercase tracking-[0.3em] text-silver-100">
            G&nbsp;Notes
          </h1>
          <button
            onClick={createSong}
            className={`${glassSurfaceSoft} rounded-full px-3.5 py-1.5 text-xs font-semibold text-silver-100 transition hover:text-amethyst-200`}
          >
            + Nueva
          </button>
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
            className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight text-silver-50 outline-none placeholder:font-normal placeholder:text-silver-500"
          />
          {/* Deshacer / rehacer — en ESCRITORIO arriba; en móvil bajan a la barra
              inferior (al alcance del pulgar). */}
          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            <button
              onClick={() => editorRef.current?.undo()}
              className={`${glassSurfaceSoft} flex size-9 items-center justify-center rounded-xl text-base leading-none text-silver-200 transition hover:text-amethyst-200`}
              aria-label="Deshacer"
              title="Deshacer"
            >
              ↶
            </button>
            <button
              onClick={() => editorRef.current?.redo()}
              className={`${glassSurfaceSoft} flex size-9 items-center justify-center rounded-xl text-base leading-none text-silver-200 transition hover:text-amethyst-200`}
              aria-label="Rehacer"
              title="Rehacer"
            >
              ↷
            </button>
          </div>
          <SaveIndicator state={saveState} hydrated={hydrated} />
        </div>

        {/* Tira de metadatos (Nivel 4): chips ligeros + menú «···». Cierra el
            "chrome" con el separador; en móvil los chips fluyen (flex-wrap). */}
        {active && (
          <div className="flex flex-wrap items-center gap-2 border-b border-silver-200/10 px-4 pb-3 md:px-8">
            <SongMeta
              song={active}
              library={lib}
              onPatch={patchActive}
              onAssignRelease={assignRelease}
              onCreateRelease={() => setShowNewRelease(true)}
              onApplyTemplate={applyTemplate}
            />
            <div className="ml-auto">
              <OverflowMenu
                song={active}
                library={lib}
                fontId={lyricFont}
                fonts={LYRIC_FONTS}
                onChooseFont={chooseFont}
                onToggleList={toggleList}
                onCreateList={createList}
                onShare={shareSong}
                onDelete={() => setPendingDelete(active.id)}
              />
            </div>
          </div>
        )}

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* Manuscrito: la letra empieza por la IZQUIERDA y ocupa todo el ancho
              (como un bloc de notas), no centrada. Sin card ni glow. La fuente
              elegida entra por --lyric-font (cambia en vivo). */}
          <div
            className="h-full px-4 md:px-8"
            style={{ "--lyric-font": fontStack(lyricFont) } as React.CSSProperties}
          >
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
          {/* Paleta de secciones flotante: PC siempre visible, móvil desplegable. */}
          {active && (
            <SectionPalette
              onInsert={(name) => editorRef.current?.insertSection(name)}
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

        {/* Cupo de IA (móvil): aviso de límite / contador, sobre la barra. Cuando
            no hay nada que mostrar, AiQuotaStatus devuelve null y esta fila colapsa. */}
        <div className="flex justify-center px-3 empty:hidden md:hidden">
          <AiQuotaStatus />
        </div>

        {/* Barra inferior MÓVIL (< md): deshacer/rehacer/compartir al alcance del
            pulgar + Asistente (modelo). Targets grandes para tocar. */}
        <div className="flex items-center gap-2 border-t border-silver-200/10 px-3 py-2 md:hidden">
          <button
            onClick={() => editorRef.current?.undo()}
            className={`${glassSurfaceSoft} flex size-10 items-center justify-center rounded-xl text-lg text-silver-200 transition active:text-amethyst-200`}
            aria-label="Deshacer"
          >
            ↶
          </button>
          <button
            onClick={() => editorRef.current?.redo()}
            className={`${glassSurfaceSoft} flex size-10 items-center justify-center rounded-xl text-lg text-silver-200 transition active:text-amethyst-200`}
            aria-label="Rehacer"
          >
            ↷
          </button>
          <button
            onClick={shareSong}
            className={`${glassSurfaceSoft} flex size-10 items-center justify-center rounded-xl text-amethyst-300 transition active:text-amethyst-200`}
            aria-label="Compartir la letra"
          >
            <ShareIcon className="size-5" />
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="rounded-full bg-linear-to-r from-amethyst-500 to-amethyst-700 px-2 py-1 text-[0.7rem] font-bold text-white">
              IA
            </span>
            <div className="w-28">
              <SearchableSelect
                value={model}
                onChange={chooseModel}
                options={MODEL_OPTIONS}
                ariaLabel="Asistente · modelo de IA"
                searchPlaceholder="Buscar…"
                emptyText="—"
                allowCustom
                customLabel={(t) => `Usar "${t}"`}
                placement="top"
                className={COMPACT_SELECT}
              />
            </div>
          </div>
        </div>

        {/* Footer ESCRITORIO (md+): contadores · métrica · Asistente · fuente. */}
        <div className="hidden items-center gap-4 border-t border-silver-200/10 px-4 py-2 text-xs text-silver-500 md:flex md:px-8">
          <span className="tabular-nums">
            {stats.lines} versos · {stats.words} palabras ·{" "}
            <span className="text-amethyst-300">{stats.syllables}</span> sílabas
          </span>
          {stats.analysis.dominant > 0 && stats.analysis.verseCount > 2 ? (
            <span className="hidden tabular-nums sm:inline">
              Métrica{" "}
              <span className="text-amethyst-300">{stats.analysis.dominant}</span>{" "}
              · {stats.analysis.consistencyPct}%
            </span>
          ) : (
            <span className="hidden text-silver-500 sm:inline">
              sílabas por verso a la izquierda
            </span>
          )}
          <AiQuotaStatus />
          {/* Preferencias (derecha): Asistente IA (modelo) + fuente de la letra.
              En móvil se ocultan las etiquetas; los selects quedan compactos. */}
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-linear-to-r from-amethyst-500 to-amethyst-700 px-2 py-0.5 text-[0.7rem] font-bold text-white">
                IA
              </span>
              <div className="w-28 sm:w-32">
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
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-silver-500" aria-hidden>
                Aa
              </span>
              <div className="w-24">
                <SearchableSelect
                  value={lyricFont}
                  onChange={chooseFont}
                  options={FONT_OPTIONS}
                  ariaLabel="Fuente de la letra"
                  searchPlaceholder="Buscar…"
                  emptyText="—"
                  placement="top"
                  className={COMPACT_SELECT}
                />
              </div>
            </div>
          </div>
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

      <ShareDialog
        open={showShare}
        title={active?.title ?? ""}
        body={active?.body ?? ""}
        genre={active?.genre || undefined}
        onClose={() => setShowShare(false)}
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
