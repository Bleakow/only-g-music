"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { uploadUserFile } from "@/features/uploads/lib/uploads-repo";
import {
  ImageIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/components/icons";

/**
 * Recuadro de carga de foto CLICKEABLE: la caja entera es el botón (clic = elegir
 * archivo), sin botones sueltos al lado. Muestra la miniatura cuando hay foto,
 * un estado vacío con ícono cuando no, spinner mientras sube y un botón de quitar
 * en la esquina. La subida se delega a `uploadUserFile` (no toca Storage directo).
 * Controlado: `value` es la URL ("" = vacío); `onChange("")` la limpia.
 */
export function PhotoUpload({
  value,
  onChange,
  aspect = "aspect-[3/4]",
  label,
  hint,
  emptyLabel,
  maxSizeMB = 25,
  onError,
  ariaLabel,
}: {
  value: string;
  onChange: (url: string) => void;
  /** Clase de relación de aspecto del recuadro (p. ej. "aspect-video"). */
  aspect?: string;
  label?: string;
  hint?: string;
  /** Texto del estado vacío (por defecto "Subir foto"). */
  emptyLabel?: string;
  maxSizeMB?: number;
  onError?: (msg: string) => void;
  ariaLabel?: string;
}) {
  const t = useTranslations();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!user) {
      onError?.(t("photoUpload.signIn"));
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      onError?.(t("photoUpload.tooLarge", { maxMb: maxSizeMB }));
      return;
    }
    setBusy(true);
    try {
      const up = await uploadUserFile(user.uid, file);
      onChange(up.url);
    } catch (err) {
      console.error("[photo-upload]:", err);
      onError?.(t("photoUpload.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {label && (
        <p className="text-silver-300 text-xs font-semibold tracking-[1px] uppercase">
          {label}
        </p>
      )}
      {hint && <p className="text-silver-400 mt-0.5 text-[11px]">{hint}</p>}

      <div className={`relative ${label || hint ? "mt-2" : ""} ${aspect}`}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={ariaLabel ?? emptyLabel ?? t("photoUpload.add")}
          className="group hover:border-amethyst-300/60 absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/[0.04] transition"
        >
          {value ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 text-xs font-semibold text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                <ImageIcon className="size-4" />
                {t("photoUpload.change")}
              </span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-white/40 transition group-hover:text-white/70">
              <PlusIcon className="size-7" />
              <span className="px-2 text-center text-xs">
                {emptyLabel ?? t("photoUpload.add")}
              </span>
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-black/55">
              <SpinnerIcon className="size-6 animate-spin text-white" />
            </span>
          )}
        </button>

        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("photoUpload.remove")}
            className="absolute top-1.5 right-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-red-500/70"
          >
            <TrashIcon className="size-3.5" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={pick}
        className="hidden"
      />
    </div>
  );
}
