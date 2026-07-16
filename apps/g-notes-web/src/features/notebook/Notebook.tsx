"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  countLines,
  countWords,
  lineSyllables,
} from "@/features/notebook/syllables";

const STORAGE_KEY = "g-notes:draft:default";
const AUTOSAVE_MS = 900;

type SaveState = "idle" | "saving" | "saved";

interface Draft {
  title: string;
  body: string;
}

function lineAtCaret(text: string, caret: number): string {
  const start = text.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
  const nextBreak = text.indexOf("\n", caret);
  return text.slice(start, nextBreak === -1 ? text.length : nextBreak);
}

export function Notebook() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [caret, setCaret] = useState(0);

  const savedRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar borrador local al montar (una sola vez).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Draft;
        setTitle(draft.title ?? "");
        setBody(draft.body ?? "");
        savedRef.current = JSON.stringify(draft);
      }
    } catch {
      /* localStorage no disponible o corrupto: empezamos en blanco */
    }
    setHydrated(true);
  }, []);

  // Autosave con debounce (mismo patrón que ProfileBuilder en only-g-web).
  useEffect(() => {
    if (!hydrated) return;
    const snapshot = JSON.stringify({ title, body } satisfies Draft);
    if (snapshot === savedRef.current) return;

    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, snapshot);
        savedRef.current = snapshot;
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, AUTOSAVE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [title, body, hydrated]);

  const stats = useMemo(
    () => ({
      lines: countLines(body),
      words: countWords(body),
      syllables: body
        .split("\n")
        .reduce((total, line) => total + lineSyllables(line), 0),
    }),
    [body],
  );

  const current = useMemo(() => {
    const line = lineAtCaret(body, caret);
    return { syllables: lineSyllables(line), words: countWords(line) };
  }, [body, caret]);

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-6 sm:py-10">
      <div className="flex w-full max-w-3xl flex-1 flex-col gap-4">
        <header className="flex items-end justify-between px-1">
          <div>
            <h1 className="bg-gradient-to-r from-amethyst-300 to-amethyst-500 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              G&nbsp;Notes
            </h1>
            <p className="mt-0.5 text-xs text-silver-400">
              Escritor inteligente · Only&nbsp;G&nbsp;Music
            </p>
          </div>
          <SaveIndicator state={saveState} hydrated={hydrated} />
        </header>

        <section className="glass flex flex-1 flex-col overflow-hidden rounded-2xl shadow-2xl shadow-black/40">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título de la canción…"
            aria-label="Título"
            className="notebook-surface w-full bg-transparent px-6 pt-5 pb-3 text-xl font-semibold text-silver-50 outline-none"
          />
          <div className="mx-6 h-px bg-silver-200/10" />
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setCaret(e.target.selectionStart);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            onClick={(e) => setCaret(e.currentTarget.selectionStart)}
            onKeyUp={(e) => setCaret(e.currentTarget.selectionStart)}
            placeholder={"Escribe tu primer verso…\n\nEmpieza a escribir. Se guarda solo."}
            aria-label="Letra"
            spellCheck
            className="notebook-surface min-h-[45dvh] flex-1 resize-none bg-transparent px-6 py-4 text-[1.05rem] leading-8 text-silver-100 outline-none"
          />
          <div className="flex items-center justify-between gap-3 border-t border-silver-200/10 px-6 py-3 text-xs text-silver-400">
            <span className="tabular-nums">
              <span className="text-amethyst-300">{current.syllables}</span> síl
              · {current.words} pal
              <span className="ml-1 text-silver-500">en esta línea</span>
            </span>
            <span className="tabular-nums text-silver-500">
              {stats.lines} versos · {stats.words} palabras · {stats.syllables}{" "}
              sílabas
            </span>
          </div>
        </section>

        <p className="px-1 text-center text-[0.7rem] text-silver-500">
          La IA no reemplaza al artista. La potencia.
        </p>
      </div>
    </main>
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
    <div className="flex items-center gap-1.5 text-xs text-silver-400">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          state === "saving"
            ? "animate-pulse bg-warning"
            : "bg-amethyst-400"
        }`}
        aria-hidden
      />
      {label}
    </div>
  );
}
