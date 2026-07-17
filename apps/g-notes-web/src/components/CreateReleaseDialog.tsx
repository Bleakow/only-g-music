"use client";

import { useEffect, useState } from "react";
import { Button, glassSurfaceMenu } from "@only-g/ui";
import {
  KIND_LABEL,
  RELEASE_KINDS,
  type ReleaseKind,
} from "@/features/library/types";

interface Props {
  open: boolean;
  onCreate: (name: string, kind: ReleaseKind) => void;
  onCancel: () => void;
}

/**
 * Diálogo para crear un release (álbum/EP/LP/single/mixtape). El formato se elige
 * con pills en vez de un <select> portalizado: evita que el menú del select (z-90)
 * quede por debajo del overlay del diálogo (z-100).
 */
export function CreateReleaseDialog({ open, onCreate, onCancel }: Props) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ReleaseKind>("album");

  useEffect(() => {
    if (open) {
      setName("");
      setKind("album");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const canCreate = name.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`${glassSurfaceMenu} w-full max-w-sm rounded-2xl p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-silver-50">Nuevo release</h2>
        <p className="mt-1 text-sm text-silver-300">
          Un contenedor para agrupar canciones: álbum, EP, LP, single o mixtape.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-silver-500">
              Nombre
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) onCreate(name.trim(), kind);
              }}
              placeholder="p. ej. Nocturno"
              className="w-full rounded-lg border border-silver-200/10 bg-white/[0.03] px-3 py-2 text-sm text-silver-100 outline-none transition placeholder:text-silver-500 focus-visible:ring-2 focus-visible:ring-amethyst-300/70"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-silver-500">
              Formato
            </label>
            <div className="flex flex-wrap gap-1.5">
              {RELEASE_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                    kind === k
                      ? "border-amethyst-400/60 bg-amethyst-500/15 text-silver-50"
                      : "border-silver-200/10 text-silver-300 hover:border-silver-200/25"
                  }`}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!canCreate}
            onClick={() => onCreate(name.trim(), kind)}
          >
            Crear
          </Button>
        </div>
      </div>
    </div>
  );
}
