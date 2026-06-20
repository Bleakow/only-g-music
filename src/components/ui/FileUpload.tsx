"use client";

import { useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { CloseIcon } from "@/components/icons";
import {
  uploadUserFile,
  type UploadedFile,
} from "@/features/uploads/lib/uploads-repo";

export type { UploadedFile };

function PaperclipIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.8 17.3a1.6 1.6 0 0 1-2.3-2.3l7.8-7.8" />
    </svg>
  );
}

/**
 * Componente reutilizable de carga de archivos. La subida se delega al
 * repositorio `uploadUserFile` (la UI no toca Storage directo). Muestra los
 * archivos subidos como chips removibles.
 *
 * - Con `children` (p. ej. un <input>): los envuelve en un recuadro y coloca el
 *   ícono de clip DENTRO, a la derecha.
 * - Sin `children`: renderiza solo un botón-ícono compacto.
 */
export function FileUpload({
  value,
  onChange,
  accept,
  maxSizeMB = 25,
  children,
}: {
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  accept?: string;
  maxSizeMB?: number;
  children?: ReactNode;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    if (!user) {
      setError("Inicia sesión para adjuntar archivos.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of files) {
        if (file.size > maxSizeMB * 1024 * 1024) {
          setError(`"${file.name}" supera ${maxSizeMB} MB.`);
          continue;
        }
        uploaded.push(await uploadUserFile(user.uid, file));
      }
      if (uploaded.length) onChange([...value, ...uploaded]);
    } catch (err) {
      console.error("[upload] error:", err);
      setError("No se pudo subir el archivo. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      {children ? (
        <div className="flex items-stretch rounded-lg border border-white/15 bg-black/30 transition focus-within:border-amethyst-300 focus-within:ring-1 focus-within:ring-amethyst-300/80">
          {children}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label="Adjuntar archivos"
            title="Adjuntar archivos"
            className="flex shrink-0 items-center justify-center px-3 text-silver-300 transition hover:text-white disabled:opacity-50"
          >
            <PaperclipIcon className={`size-5 ${busy ? "animate-pulse" : ""}`} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex min-h-11 w-fit items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-silver-100 transition hover:border-amethyst-300 hover:text-white disabled:opacity-60"
        >
          <PaperclipIcon className="size-4" />
          {busy ? "Subiendo…" : "Adjuntar"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        onChange={onPick}
        className="hidden"
      />

      {error && <p className="text-sm text-red-300">{error}</p>}

      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.map((f, i) => (
            <li
              key={`${f.url}-${i}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 py-1 pl-3 pr-1 text-sm"
            >
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-silver-100 underline-offset-2 hover:text-white hover:underline"
              >
                {f.name}
              </a>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Quitar ${f.name}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-silver-400 transition hover:bg-white/10 hover:text-white"
              >
                <CloseIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
