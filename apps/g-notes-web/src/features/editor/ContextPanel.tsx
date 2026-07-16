"use client";

import { useEffect, useRef, useState } from "react";
import { createAiClient, type CreativeOp } from "@only-g/ai-services";
import type { EditorSelection } from "@/features/editor/LyricsEditor";

const client = createAiClient();

const OPS: { op: CreativeOp; label: string }[] = [
  { op: "rimas", label: "Rimas" },
  { op: "frases", label: "Frases" },
  { op: "metaforas", label: "Metáforas" },
  { op: "expandir", label: "Expandir" },
];

interface Props {
  selection: EditorSelection | null;
  genre?: string;
  context?: string;
  onApply: (from: number, to: number, text: string) => void;
  onClose: () => void;
}

/**
 * Panel que aparece al seleccionar texto: rimas, frases similares, metáforas y
 * expansión. Aparece solo cuando aporta valor — nada de chatbot permanente.
 */
export function ContextPanel({
  selection,
  genre,
  context,
  onApply,
  onClose,
}: Props) {
  const [op, setOp] = useState<CreativeOp | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [source, setSource] = useState<"ai" | "stub" | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const key = selection ? `${selection.from}:${selection.to}` : "";

  // Reiniciar el panel cuando cambia la selección.
  useEffect(() => {
    setOp(null);
    setItems([]);
    setSource(null);
    setLoading(false);
    controllerRef.current?.abort();
  }, [key]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, onClose]);

  if (!selection) return null;

  async function run(next: CreativeOp) {
    if (!selection) return;
    setOp(next);
    setLoading(true);
    setItems([]);
    setSource(null);
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    try {
      const res = await client.creative(
        { op: next, text: selection.text, context, genre },
        controllerRef.current.signal,
      );
      setItems(res.suggestions);
      setSource(res.source);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function apply(text: string) {
    if (!selection) return;
    if (op === "expandir") {
      onApply(selection.to, selection.to, `\n${text}`);
    } else {
      onApply(selection.from, selection.to, text);
    }
  }

  return (
    <div
      className="glass fixed z-30 w-72 rounded-xl p-2 shadow-2xl shadow-black/50"
      style={{
        top: selection.top,
        left: Math.max(
          8,
          Math.min(selection.left, window.innerWidth - 296),
        ),
        transform: "translateY(calc(-100% - 8px))",
      }}
      // Evita robar el foco (y borrar la selección) del editor al interactuar.
      onMouseDown={(e) => e.preventDefault()}
      role="dialog"
      aria-label="Herramientas creativas"
    >
      <div className="flex gap-1">
        {OPS.map(({ op: o, label }) => (
          <button
            key={o}
            onClick={() => run(o)}
            className={`flex-1 rounded-md px-2 py-1 text-xs transition ${
              op === o
                ? "bg-amethyst-500/25 text-amethyst-300"
                : "text-silver-300 hover:bg-silver-200/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {op && (
        <div className="mt-2 max-h-56 overflow-y-auto">
          {loading && (
            <p className="px-2 py-3 text-xs text-silver-400">Pensando…</p>
          )}
          {!loading && items.length === 0 && (
            <p className="px-2 py-3 text-xs text-silver-500">Sin sugerencias.</p>
          )}
          {!loading &&
            items.map((s, i) => (
              <button
                key={i}
                onClick={() => apply(s)}
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-silver-100 transition hover:bg-amethyst-500/15"
              >
                {s}
              </button>
            ))}
          {source === "stub" && !loading && items.length > 0 && (
            <p className="px-2 pt-1 text-[0.65rem] text-silver-500">
              demo · sin IA (configura ANTHROPIC_API_KEY)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
