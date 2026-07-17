"use client";

import { useState } from "react";
import {
  GROUP_LABEL,
  organize,
  type GroupBy,
} from "@/features/library/organize";
import { STATE_DOT, type Library } from "@/features/library/types";

const GROUP_ORDER: GroupBy[] = ["none", "estado", "genero", "release", "lista"];

/**
 * Lista de la biblioteca con organizador "Ver por…" (todas / estado / género /
 * álbum / lista). Las secciones agrupadas son colapsables. Presentacional: la
 * lógica de selección/borrado vive en Notebook.
 */
export function LibraryList({
  library,
  activeId,
  groupBy,
  onGroupByChange,
  onSelect,
  onRequestDelete,
}: {
  library: Library;
  activeId: string | null;
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  onSelect: (id: string) => void;
  onRequestDelete: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const sections = organize(library, groupBy);
  const grouped = groupBy !== "none";

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Ver por … */}
      <div className="mb-2 flex flex-wrap gap-1">
        {GROUP_ORDER.map((g) => (
          <button
            key={g}
            onClick={() => onGroupByChange(g)}
            className={`rounded-md px-2 py-0.5 text-[0.7rem] transition ${
              groupBy === g
                ? "bg-amethyst-500/25 text-silver-50"
                : "text-silver-400 hover:bg-silver-200/5 hover:text-silver-200"
            }`}
          >
            {GROUP_LABEL[g]}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {sections.map((sec) => {
          const isCollapsed = grouped && collapsed.has(sec.key);
          return (
            <div key={sec.key}>
              {grouped && (
                <button
                  onClick={() => toggle(sec.key)}
                  className={`flex w-full items-center gap-1.5 px-1 py-1 text-left text-[0.7rem] uppercase tracking-wide transition hover:text-silver-200 ${
                    sec.loose ? "text-silver-500" : "text-amethyst-300"
                  }`}
                >
                  <span
                    className={`inline-block transition-transform ${
                      isCollapsed ? "" : "rotate-90"
                    }`}
                    aria-hidden
                  >
                    ›
                  </span>
                  <span className="flex-1 truncate">{sec.label}</span>
                  <span className="text-silver-500">{sec.songs.length}</span>
                </button>
              )}

              {!isCollapsed && (
                <ul className="space-y-1">
                  {sec.songs.length === 0 && grouped ? (
                    <li className="px-3 py-1 text-xs text-silver-500">Vacío</li>
                  ) : (
                    sec.songs.map((s) => (
                      <li key={`${sec.key}:${s.id}`}>
                        <button
                          onClick={() => onSelect(s.id)}
                          className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                            s.id === activeId
                              ? "bg-amethyst-500/20 text-silver-50"
                              : "text-silver-300 hover:bg-silver-200/5"
                          }`}
                        >
                          {groupBy === "release" && s.trackNo != null && (
                            <span className="w-4 shrink-0 text-right text-xs tabular-nums text-silver-500">
                              {s.trackNo}
                            </span>
                          )}
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATE_DOT[s.estado]}`}
                            aria-hidden
                          />
                          <span className="flex-1 truncate">
                            {s.title.trim() || "Sin título"}
                          </span>
                          {s.genre && (
                            <span className="shrink-0 rounded bg-ink/40 px-1.5 py-0.5 text-[0.6rem] text-amethyst-300">
                              {s.genre}
                            </span>
                          )}
                          <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRequestDelete(s.id);
                            }}
                            className="shrink-0 text-silver-500 opacity-0 transition hover:text-danger group-hover:opacity-100"
                            aria-label="Eliminar"
                          >
                            ✕
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
