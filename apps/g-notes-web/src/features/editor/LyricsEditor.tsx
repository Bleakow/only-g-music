"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { lyricExtensions } from "@/features/editor/lyric-extensions";

export interface LyricsEditorHandle {
  insertSection: (name: string) => void;
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export const LyricsEditor = forwardRef<LyricsEditorHandle, Props>(
  function LyricsEditor({ value, onChange }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

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
          }),
          ...lyricExtensions,
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
      focus() {
        viewRef.current?.focus();
      },
    }));

    return <div ref={host} className="h-full overflow-hidden" />;
  },
);
