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
  highlightActiveLine,
  placeholder,
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
      color: "var(--color-lyric)",
      backgroundColor: "transparent",
      height: "100%",
      fontSize: "1.18rem",
    },
    // La LETRA en la fuente elegida (--lyric-font, por defecto la serif editorial):
    // es el manuscrito, el héroe de la pantalla. Se cambia en vivo por variable CSS.
    ".cm-scroller": {
      fontFamily: "var(--lyric-font, var(--font-serif))",
      lineHeight: "1.95",
      overflow: "auto",
      // Scroll SUTIL: barra fina y apagada (Firefox). En webkit, más abajo.
      scrollbarWidth: "thin",
      scrollbarColor: "rgba(255,255,255,0.14) transparent",
    },
    ".cm-scroller::-webkit-scrollbar": { width: "10px", height: "10px" },
    ".cm-scroller::-webkit-scrollbar-track": { background: "transparent" },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      background: "rgba(255,255,255,0.10)",
      borderRadius: "999px",
      border: "3px solid transparent",
      backgroundClip: "padding-box",
    },
    ".cm-scroller::-webkit-scrollbar-thumb:hover": {
      background: "rgba(255,255,255,0.20)",
      backgroundClip: "padding-box",
    },
    // Relleno inferior MÍNIMO: sin scroll prematuro. La barra aparece solo cuando
    // la letra de verdad llega al límite (como un bloc de notas), no antes.
    ".cm-content": { padding: "0.75rem 0 1.5rem 0", caretColor: "#a87bff" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#a87bff" },
    ".cm-line": { padding: "0 1.5rem" },
    // Línea activa: un SUSURRO neutral (no amatista) — foco sin "gaming glow".
    ".cm-activeLine": {
      backgroundColor: "rgba(255,255,255,0.022)",
      borderRadius: "0.375rem",
    },
    // Placeholder: invita a escribir cuando la canción está en blanco.
    ".cm-placeholder": {
      color: "color-mix(in oklab, #7e7e95 85%, transparent)",
      fontStyle: "italic",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "color-mix(in oklab, #8b5cf6 24%, transparent)",
      },
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
      color: "color-mix(in oklab, #7e7e95 70%, transparent)",
    },
    ".cm-syl-gutter": {
      minWidth: "2.2rem",
      padding: "0 0.6rem 0 0.25rem",
      textAlign: "right",
      fontSize: "0.66rem",
      fontFamily: "var(--font-sans)",
      fontVariantNumeric: "tabular-nums",
    },
    ".cm-syl-match": { color: "color-mix(in oklab, #c4a5ff 78%, transparent)" },
    ".cm-syl-near": { color: "#7e7e95" },
    ".cm-syl-off": { color: "#e8b14c", fontWeight: "600" },
    // Marcador de sección: etiqueta fina, en versalitas espaciadas, amatista tenue.
    ".cm-section-line": {
      color: "color-mix(in oklab, #c4a5ff 88%, transparent)",
      fontFamily: "var(--font-sans)",
      fontWeight: "600",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      fontSize: "0.68rem",
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

// Corrector del DISPOSITIVO: CodeMirror por defecto apaga autocorrect/
// autocapitalize/spellcheck en el contenteditable. En un cuaderno de letras SÍ
// los queremos: que el teclado del móvil corrija, capitalice el inicio de frase
// y subraye faltas (como en cualquier bloc de notas). Sube el facet de atributos
// del contenido con estos valores → sobrescriben los defaults de CM.
const deviceCorrector = EditorView.contentAttributes.of({
  autocorrect: "on",
  autocapitalize: "sentences",
  spellcheck: "true",
});

export const lyricExtensions = [
  lyricTheme,
  analysisField,
  EditorView.lineWrapping,
  highlightActiveLine(),
  placeholder("Escribe aquí tu primera línea…"),
  syllableGutter,
  sectionHighlighter,
  deviceCorrector,
];
