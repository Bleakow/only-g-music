// Autocompletado inline tipo Copilot para CodeMirror: muestra una sugerencia
// "fantasma" al final del verso; Tab la acepta, Esc (o seguir escribiendo) la
// descarta. La sugerencia la sirve el route handler /api/ai/complete vía el
// cliente @only-g/ai-services (Claude si hay API key; stub si no).

import { Prec, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  keymap,
} from "@codemirror/view";
import type { AiClient } from "@only-g/ai-services";
import { analysisField } from "@/features/editor/lyric-extensions";

const DEBOUNCE_MS = 450;
const MIN_LINE_CHARS = 3;

interface Ghost {
  text: string;
  pos: number;
}

const setGhost = StateEffect.define<Ghost | null>();

const ghostField = StateField.define<Ghost | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setGhost)) return e.value;
    // Cualquier edición o movimiento de cursor invalida la sugerencia.
    if (tr.docChanged || tr.selection) return null;
    return value;
  },
  provide: (f) =>
    EditorView.decorations.from(f, (g) => (g ? ghostDeco(g) : Decoration.none)),
});

class GhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: GhostWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-ghost";
    span.textContent = this.text;
    return span;
  }
}

function ghostDeco(g: Ghost): DecorationSet {
  return Decoration.set([
    Decoration.widget({ widget: new GhostWidget(g.text), side: 1 }).range(g.pos),
  ]);
}

function fetcher(client: AiClient) {
  return ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | null = null;
      controller: AbortController | null = null;
      constructor(readonly view: EditorView) {}

      update(u: ViewUpdate) {
        if (u.docChanged) this.schedule();
      }

      schedule() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.run(), DEBOUNCE_MS);
      }

      async run() {
        const { view } = this;
        const state = view.state;
        const sel = state.selection.main;
        if (!sel.empty) return;
        const pos = sel.head;
        const line = state.doc.lineAt(pos);
        if (pos !== line.to) return; // solo al final del verso
        if (line.text.trim().length < MIN_LINE_CHARS) return;

        this.controller?.abort();
        this.controller = new AbortController();
        const analysis = state.field(analysisField, false);
        const targetMeter =
          analysis && analysis.dominant > 0 ? analysis.dominant : undefined;

        try {
          const res = await client.complete(
            { prefix: state.sliceDoc(0, pos), targetMeter },
            this.controller.signal,
          );
          const suggestion =
            res.suggestion && res.suggestion.trim() ? res.suggestion : "";
          // Aplicar solo si el cursor sigue exactamente donde estaba.
          if (suggestion && view.state.selection.main.head === pos) {
            view.dispatch({ effects: setGhost.of({ text: suggestion, pos }) });
          }
        } catch {
          /* abortado o error de red: sin sugerencia */
        }
      }

      destroy() {
        if (this.timer) clearTimeout(this.timer);
        this.controller?.abort();
      }
    },
  );
}

const ghostKeymap = Prec.highest(
  keymap.of([
    {
      key: "Tab",
      run: (view) => {
        const g = view.state.field(ghostField, false);
        if (!g) return false;
        view.dispatch({
          changes: { from: g.pos, insert: g.text },
          selection: { anchor: g.pos + g.text.length },
          effects: setGhost.of(null),
        });
        return true;
      },
    },
    {
      key: "Escape",
      run: (view) => {
        if (!view.state.field(ghostField, false)) return false;
        view.dispatch({ effects: setGhost.of(null) });
        return true;
      },
    },
  ]),
);

const ghostTheme = EditorView.theme({
  ".cm-ghost": {
    color: "color-mix(in oklab, #9a9ab0 78%, transparent)",
    fontStyle: "italic",
  },
});

/** Extensión de autocompletado inline, cableada a un cliente de IA. */
export function ghostCompletion(client: AiClient) {
  return [ghostField, fetcher(client), ghostKeymap, ghostTheme];
}
