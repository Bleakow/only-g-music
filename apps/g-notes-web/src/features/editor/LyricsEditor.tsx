"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  redo,
  undo,
} from "@codemirror/commands";
import { createAiClient } from "@only-g/ai-services";
import { lyricExtensions } from "@/features/editor/lyric-extensions";
import { ghostCompletion } from "@/features/editor/ghost";

// Cliente de IA al mismo origen (baseUrl vacío → POST /api/ai/complete).
const aiClient = createAiClient();

export interface EditorSelection {
  text: string;
  from: number;
  to: number;
  /** Coords de viewport para posicionar el panel contextual (arriba o abajo). */
  top: number;
  bottom: number;
  left: number;
}

export interface LyricsEditorHandle {
  insertSection: (name: string) => void;
  insertTemplate: (sections: string[]) => void;
  replaceRange: (from: number, to: number, text: string) => void;
  undo: () => void;
  redo: () => void;
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelection?: (sel: EditorSelection | null) => void;
}

function reportSelection(
  view: EditorView,
  cb: ((sel: EditorSelection | null) => void) | undefined,
) {
  if (!cb) return;
  const sel = view.state.selection.main;
  if (sel.empty) {
    cb(null);
    return;
  }
  const coords = view.coordsAtPos(sel.from);
  if (!coords) {
    cb(null);
    return;
  }
  cb({
    text: view.state.sliceDoc(sel.from, sel.to),
    from: sel.from,
    to: sel.to,
    top: coords.top,
    bottom: coords.bottom,
    left: coords.left,
  });
}

export const LyricsEditor = forwardRef<LyricsEditorHandle, Props>(
  function LyricsEditor({ value, onChange, onSelection }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onSelectionRef = useRef(onSelection);
    onSelectionRef.current = onSelection;

    // Crear la vista una sola vez (StrictMode: se destruye y recrea, es idempotente).
    useEffect(() => {
      if (!host.current) return;
      const state = EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
            if (u.selectionSet || u.docChanged || u.geometryChanged) {
              reportSelection(u.view, onSelectionRef.current);
            }
          }),
          ...lyricExtensions,
          ...ghostCompletion(aiClient),
        ],
      });
      const view = new EditorView({ state, parent: host.current });
      viewRef.current = view;
      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // Solo al montar: el valor externo se reconcilia en el efecto de abajo.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reconciliar cambios de valor externos (cambiar de canción activa).
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (value !== current) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
        });
      }
    }, [value]);

    useImperativeHandle(ref, () => ({
      insertSection(name: string) {
        const view = viewRef.current;
        if (!view) return;
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        const atLineStart = pos === line.from;
        const empty = line.text.trim() === "";
        const snippet = empty
          ? `[${name}]\n`
          : atLineStart
            ? `[${name}]\n`
            : `\n[${name}]\n`;
        view.dispatch({
          changes: { from: pos, insert: snippet },
          selection: { anchor: pos + snippet.length },
        });
        view.focus();
      },
      insertTemplate(sections: string[]) {
        const view = viewRef.current;
        if (!view) return;
        // Cada sección en su línea, con un renglón en blanco debajo para escribir.
        const skeleton = sections.map((s) => `[${s}]\n\n`).join("");
        if (view.state.doc.length === 0) {
          view.dispatch({
            changes: { from: 0, insert: skeleton },
            selection: { anchor: skeleton.length },
          });
        } else {
          const pos = view.state.selection.main.head;
          const line = view.state.doc.lineAt(pos);
          const snippet = (line.text.trim() === "" ? "" : "\n") + skeleton;
          view.dispatch({
            changes: { from: pos, insert: snippet },
            selection: { anchor: pos + snippet.length },
          });
        }
        view.focus();
      },
      replaceRange(from, to, text) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        view.focus();
      },
      undo() {
        const view = viewRef.current;
        if (!view) return;
        undo(view);
        view.focus();
      },
      redo() {
        const view = viewRef.current;
        if (!view) return;
        redo(view);
        view.focus();
      },
      focus() {
        viewRef.current?.focus();
      },
    }));

    return <div ref={host} className="h-full overflow-hidden" />;
  },
);
