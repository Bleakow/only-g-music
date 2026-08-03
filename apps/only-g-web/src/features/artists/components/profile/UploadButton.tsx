"use client";

import { useRef } from "react";
import { GlassButton } from "@/components/ui/GlassButton";

/**
 * Botón que abre un selector de archivos oculto y entrega los `File` elegidos.
 * `glass` lo renderiza como GlassButton (mismo estilo que Atrás/Ajustes).
 *
 * Compartido por el editor de perfil y sus piezas (foto, media destacada, galería).
 */
export function UploadButton({
  accept,
  multiple,
  disabled,
  onFiles,
  className,
  children,
  glass,
  title,
  ariaLabel,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  children: React.ReactNode;
  glass?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      {glass ? (
        <GlassButton
          onClick={() => ref.current?.click()}
          disabled={disabled}
          className={className}
          title={title}
          ariaLabel={ariaLabel}
        >
          {children}
        </GlassButton>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => ref.current?.click()}
          className={className}
        >
          {children}
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}
