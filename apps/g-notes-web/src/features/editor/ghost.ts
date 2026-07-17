// Autocompletado inline con MEMORIA POR LÍNEA. Cada sugerencia se ancla al verso
// para el que se generó (identificado por su texto sin espacios de sobra):
//  · Se muestra SOLO cuando el cursor está en esa línea; si te vas, se oculta pero
//    sigue viva; si vuelves, reaparece la MISMA sugerencia (no se regenera).
//  · Un espacio de sobra no la cambia (el texto "de verdad" no cambió).
//  · Si borras el texto de la línea, su sugerencia se va con él.
//  · Si añades palabras nuevas a la línea, se genera una sugerencia nueva.
// Aceptar: Tab o tocar el texto (móvil). Regenerar: botón ↻ o Ctrl+\.
// La sirve /api/ai/complete vía @only-g/ai-services (Gemini/Claude, o stub sin key).

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
import { getModel } from "@/features/ai/model-store";

const DEBOUNCE_MS = 450;
const MIN_LINE_CHARS = 3;
// Techo de sugerencias vivas: solo las 3 líneas más recientes conservan su
// recomendación. Al generar una nueva se descarta la más antigua (FIFO), para no
// acumular peticiones si alguien va generando verso por verso.
const MAX_GHOSTS = 3;

interface Ghost {
  /** Inicio de la línea anclada (se mapea a través de las ediciones). */
  lineFrom: number;
  /** Texto (sin espacios de sobra) del verso para el que se generó. */
  forText: string;
  /** La sugerencia. */
  text: string;
}

/** Extensión de autocompletado inline con memoria por línea. */
export function ghostCompletion(client: AiClient) {
  // Referencia a la vista, compartida con los listeners del widget (que se crea
  // sin acceso directo a la vista). La fija el ViewPlugin al montar.
  let view: EditorView | null = null;

  const upsertGhost = StateEffect.define<Ghost>();
  const removeGhostAt = StateEffect.define<number>(); // por lineFrom
  const clearGhosts = StateEffect.define<null>();
  const refreshGhost = StateEffect.define<null>();

  const ghostField = StateField.define<Ghost[]>({
    create: () => [],
    update(list, tr) {
      let next = list;
      // 1) Mapear posiciones y podar sugerencias obsoletas (línea borrada o cuyo
      //    texto cambió → deja de existir la sugerencia, tal como se pidió).
      if (tr.docChanged) {
        const doc = tr.newDoc;
        next = next
          .map((g) => ({ ...g, lineFrom: tr.changes.mapPos(g.lineFrom, -1) }))
          .filter(
            (g) =>
              g.lineFrom >= 0 &&
              g.lineFrom <= doc.length &&
              doc.lineAt(g.lineFrom).text.trim() === g.forText,
          );
      }
      // 2) Aplicar efectos (alta/baja explícita).
      for (const e of tr.effects) {
        if (e.is(clearGhosts)) next = [];
        else if (e.is(removeGhostAt))
          next = next.filter((g) => g.lineFrom !== e.value);
        else if (e.is(upsertGhost))
          next = [
            ...next.filter((g) => g.lineFrom !== e.value.lineFrom),
            e.value,
          ].slice(-MAX_GHOSTS);
      }
      return next;
    },
  });

  // Devuelve la sugerencia que DEBE mostrarse ahora (cursor en su línea y con el
  // texto aún coincidiendo), o null. Fuente única para render, aceptar y Esc.
  function activeGhost(
    state: EditorView["state"],
  ): { lineFrom: number; at: number; text: string } | null {
    const sel = state.selection.main;
    if (!sel.empty) return null;
    const list = state.field(ghostField, false);
    if (!list || list.length === 0) return null;
    const cur = state.doc.lineAt(sel.head);
    for (const g of list) {
      if (g.lineFrom < 0 || g.lineFrom > state.doc.length) continue;
      const gl = state.doc.lineAt(g.lineFrom);
      if (gl.from === cur.from && gl.text.trim() === g.forText) {
        return { lineFrom: g.lineFrom, at: gl.to, text: g.text };
      }
    }
    return null;
  }

  function acceptGhost(v: EditorView): boolean {
    const info = activeGhost(v.state);
    if (!info) return false;
    v.dispatch({
      changes: { from: info.at, insert: info.text },
      selection: { anchor: info.at + info.text.length },
      effects: removeGhostAt.of(info.lineFrom),
    });
    v.focus();
    return true;
  }

  class GhostWidget extends WidgetType {
    constructor(readonly text: string) {
      super();
    }
    eq(other: GhostWidget) {
      return other.text === this.text;
    }
    toDOM() {
      const wrap = document.createElement("span");
      wrap.className = "cm-ghost";
      wrap.setAttribute("contenteditable", "false");

      const label = document.createElement("span");
      label.className = "cm-ghost-text";
      label.textContent = this.text;
      label.title = "Tocar para aceptar (Tab)";
      // Aceptar tocando el texto: imprescindible en móvil (no hay tecla Tab).
      label.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (view) acceptGhost(view);
      });
      wrap.appendChild(label);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cm-ghost-refresh";
      btn.textContent = "↻";
      btn.title = "Regenerar sugerencia (Ctrl+\\)";
      btn.setAttribute("aria-label", "Regenerar sugerencia");
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        view?.dispatch({ effects: refreshGhost.of(null) });
        view?.focus();
      });
      wrap.appendChild(btn);
      return wrap;
    }
    ignoreEvent() {
      return true;
    }
  }

  function ghostDeco(at: number, text: string): DecorationSet {
    return Decoration.set([
      Decoration.widget({ widget: new GhostWidget(text), side: 1 }).range(at),
    ]);
  }

  // Render: recalcula la decoración cuando cambia el doc, la selección o el campo.
  const renderer = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(v: EditorView) {
        this.decorations = this.build(v);
      }
      update(u: ViewUpdate) {
        const touchedField = u.transactions.some((t) =>
          t.effects.some(
            (e) =>
              e.is(upsertGhost) || e.is(removeGhostAt) || e.is(clearGhosts),
          ),
        );
        if (u.docChanged || u.selectionSet || touchedField) {
          this.decorations = this.build(u.view);
        }
      }
      build(v: EditorView): DecorationSet {
        const info = activeGhost(v.state);
        return info ? ghostDeco(info.at, info.text) : Decoration.none;
      }
    },
    { decorations: (x) => x.decorations },
  );

  const fetcher = ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | null = null;
      controller: AbortController | null = null;
      constructor(readonly v: EditorView) {
        view = v;
      }

      update(u: ViewUpdate) {
        const refreshed = u.transactions.some((t) =>
          t.effects.some((e) => e.is(refreshGhost)),
        );
        if (refreshed) {
          void this.run(true);
          return;
        }
        if (u.docChanged || u.selectionSet) this.schedule();
      }

      schedule() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.run(false), DEBOUNCE_MS);
      }

      async run(force: boolean) {
        const state = this.v.state;
        const sel = state.selection.main;
        if (!sel.empty) return;
        const line = state.doc.lineAt(sel.head);
        if (!force && sel.head !== line.to) return; // auto: solo al final del verso
        const trimmed = line.text.trim();
        if (trimmed.length < MIN_LINE_CHARS) return;

        // ¿Ya hay una sugerencia al día para ESTE verso? Entonces se conserva
        // (esto es lo que hace que un espacio o volver a la línea no la cambien).
        const list = state.field(ghostField, false) ?? [];
        const existing = list.find((g) => {
          if (g.lineFrom < 0 || g.lineFrom > state.doc.length) return false;
          const gl = state.doc.lineAt(g.lineFrom);
          return gl.from === line.from && g.forText === trimmed;
        });
        if (!force && existing) return;

        this.controller?.abort();
        this.controller = new AbortController();
        const analysis = state.field(analysisField, false);
        const targetMeter =
          analysis && analysis.dominant > 0 ? analysis.dominant : undefined;
        const lineFrom = line.from;

        try {
          const res = await client.complete(
            {
              prefix: state.sliceDoc(0, line.to),
              targetMeter,
              model: getModel(),
            },
            this.controller.signal,
          );
          const suggestion =
            res.suggestion && res.suggestion.trim() ? res.suggestion : "";
          if (!suggestion) return;
          // Re-validar: la línea sigue existiendo igual tras el await.
          const now = this.v.state;
          if (lineFrom > now.doc.length) return;
          const nl = now.doc.lineAt(lineFrom);
          if (nl.from !== lineFrom || nl.text.trim() !== trimmed) return;
          this.v.dispatch({
            effects: upsertGhost.of({ lineFrom, forText: trimmed, text: suggestion }),
          });
        } catch {
          /* abortado o error de red: sin sugerencia */
        }
      }

      destroy() {
        if (this.timer) clearTimeout(this.timer);
        this.controller?.abort();
        if (view === this.v) view = null;
      }
    },
  );

  const ghostKeymap = Prec.highest(
    keymap.of([
      {
        key: "Tab",
        run: (v) => acceptGhost(v),
      },
      {
        key: "Escape",
        run: (v) => {
          const info = activeGhost(v.state);
          if (!info) return false;
          v.dispatch({ effects: removeGhostAt.of(info.lineFrom) });
          return true;
        },
      },
      {
        // Regenerar la sugerencia del verso actual (igual que el botón ↻).
        key: "Mod-\\",
        run: (v) => {
          v.dispatch({ effects: refreshGhost.of(null) });
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
    ".cm-ghost-text": {
      cursor: "pointer",
      borderRadius: "0.25rem",
    },
    ".cm-ghost-text:hover": {
      color: "color-mix(in oklab, #c4a5ff 85%, transparent)",
      background: "color-mix(in oklab, #8b5cf6 12%, transparent)",
    },
    ".cm-ghost-refresh": {
      marginLeft: "0.4rem",
      padding: "0 0.3rem",
      border: "none",
      background: "transparent",
      color: "color-mix(in oklab, #c4a5ff 80%, transparent)",
      cursor: "pointer",
      fontSize: "0.85em",
      fontStyle: "normal",
      lineHeight: "1",
      borderRadius: "0.25rem",
      verticalAlign: "baseline",
    },
    ".cm-ghost-refresh:hover": {
      color: "#c4a5ff",
      background: "color-mix(in oklab, #8b5cf6 18%, transparent)",
    },
  });

  return [ghostField, renderer, fetcher, ghostKeymap, ghostTheme];
}
