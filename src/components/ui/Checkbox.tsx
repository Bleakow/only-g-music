"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";

/**
 * Checkbox reutilizable. Usa un input nativo oculto (accesible: teclado +
 * lector de pantalla) con una caja estilizada que refleja el estado.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={`inline-flex select-none items-center gap-2 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-amethyst-300/70 ${
          checked
            ? "border-amethyst-300 bg-amethyst-400 text-ink"
            : "border-white/25 bg-black/30 text-transparent"
        }`}
      >
        <CheckIcon className="size-3.5" />
      </span>
      {label != null && (
        <span className="text-sm text-silver-100">{label}</span>
      )}
    </label>
  );
}
