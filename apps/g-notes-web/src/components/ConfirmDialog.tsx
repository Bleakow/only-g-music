"use client";

import { useEffect } from "react";
import { Button, glassSurfaceMenu } from "@only-g/ui";

interface Props {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Diálogo de confirmación propio (glass), en vez del confirm() del navegador. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

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
        {title && (
          <h2 className="text-base font-semibold text-silver-50">{title}</h2>
        )}
        <p className="mt-1 text-sm text-silver-300">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button size="sm" variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
