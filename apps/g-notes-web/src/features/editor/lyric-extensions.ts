// Extensiones de CodeMirror 6 que convierten un editor de texto plano en un
// cuaderno de líricas: tema de marca, gutter con sílabas por verso y realce de
// las líneas de sección. Todo determinista (sin IA) — "IA solo donde aporta".

import { RangeSetBuilder, StateField } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  gutter,
  GutterMarker,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { isSectionLine } from "@/features/editor/sections";
import {
  analyzeSong,
  metricSyllables,
  type SongAnalysis,
} from "@/features/analysis/metrics";

/* ── Tema tinta + amatista ─────────────────────────────────────────── */
export const lyricTheme = EditorView.theme(
  {
    "&": {
      color: "var(--color-silver-100)",
      backgroundColor: "transparent",
      height: "100%",
      fontSize: "1.05rem",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-sans)",
      lineHeight: "2",
      overflow: "auto",
    },
    ".cm-content": { padding: "0.5rem 0 40vh 0", caretColor: "#a87bff" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#a87bff" },
    ".cm-line": { padding: "0 1rem" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "color-mix(in oklab, #8b5cf6 28%, transparent)",
      },
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
      color: "color-mix(in oklab, #c4a5ff 65%, transparent)",
    },
    ".cm-syl-gutter": {
      minWidth: "2.2rem",
      padding: "0 0.5rem 0 0.25rem",
      textAlign: "right",
      fontSize: "0.7rem",
      fontVariantNumeric: "tabular-nums",
    },
    ".cm-syl-match": { color: "#c4a5ff" },
    ".cm-syl-near": { color: "#9a9ab0" },
    ".cm-syl-off": { color: "#fbbf24", fontWeight: "600" },
    ".cm-section-line": {
      color: "#c4a5ff",
      fontWeight: "600",
      letterSpacing: "0.02em",
      textTransform: "uppercase",
      fontSize: "0.8rem",
    },
  },
  { dark: true },
);

/* ── Análisis métrico de la canción (para colorear el gutter) ──────── */
export const analysisField = StateField.define<SongAnalysis>({
  create: (state) => analyzeSong(state.doc.toString()),
  update: (value, tr) =>
    tr.docChanged ? analyzeSong(tr.newDoc.toString()) : value,
});

/* ── Gutter de sílabas métricas por verso ──────────────────────────── */
type Tone = "match" | "near" | "off";

class SyllableMarker extends GutterMarker {
  constructor(
    readonly count: number,
    readonly tone: Tone,
  ) {
    super();
  }
  eq(other: SyllableMarker) {
    return other.count === this.count && other.tone === this.tone;
  }
  toDOM() {
    const el = document.createElement("span");
    el.textContent = String(this.count);
    el.className = `cm-syl cm-syl-${this.tone}`;
    return el;
  }
}

export const syllableGutter = gutter({
  class: "cm-syl-gutter",
  lineMarker(view, line) {
    const text = view.state.doc.lineAt(line.from).text;
    if (!text.trim() || isSectionLine(text)) return null;
    const count = metricSyllables(text);
    // Colorea según se ajuste (o rompa) la métrica dominante del tema.
    const { dominant, verseCount } = view.state.field(analysisField);
    let tone: Tone = "match";
    if (dominant > 0 && verseCount > 2) {
      const delta = Math.abs(count - dominant);
      tone = delta === 0 ? "match" : delta === 1 ? "near" : "off";
    }
    return new SyllableMarker(count, tone);
  },
  lineMarkerChange: (update) => update.docChanged,
});

/* ── Realce de líneas de sección ───────────────────────────────────── */
const sectionLineDeco = Decoration.line({ class: "cm-section-line" });

function buildSectionDecos(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (isSectionLine(line.text)) {
        builder.add(line.from, line.from, sectionLineDeco);
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

export const sectionHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildSectionDecos(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildSectionDecos(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const lyricExtensions = [
  lyricTheme,
  analysisField,
  EditorView.lineWrapping,
  syllableGutter,
  sectionHighlighter,
];
