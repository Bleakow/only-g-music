"use client";

/**
 * Visualizador de fotos (lightbox) a pantalla completa. Se monta por portal en
 * <body> para que el `fixed` se ancle al viewport (y no quede atrapado por
 * ancestros con transform/backdrop-filter). Navegación con flechas, Escape,
 * swipe táctil y tap en el fondo para cerrar. Bloquea el scroll del fondo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import Image from "next/image";
import { CloseIcon, ArrowLeftIcon } from "@/components/icons";

export function PhotoViewer({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const tCommon = useTranslations("common");
  const [mounted, setMounted] = useState(false);
  const startX = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  const go = useCallback(
    (dir: number) => {
      if (images.length < 2) return;
      onNavigate((index + dir + images.length) % images.length);
    },
    [index, images.length, onNavigate],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  // Avisa al header (menú + perfil) que se oculte mientras el visor está abierto.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("ogm:viewer", { detail: true }));
    return () => {
      window.dispatchEvent(new CustomEvent("ogm:viewer", { detail: false }));
    };
  }, []);

  if (!mounted) return null;
  const many = images.length > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      // `pan-y`: el navegador conserva el scroll vertical, pero el arrastre
      // HORIZONTAL llega a los eventos de puntero (si no, en táctil el navegador
      // lo secuestra y dispara `pointercancel`, y el swipe se perdía).
      style={{ touchAction: "pan-y" }}
      onPointerDown={(e) => {
        startX.current = e.clientX;
      }}
      onPointerCancel={() => {
        startX.current = null;
      }}
      onPointerUp={(e) => {
        const sx = startX.current;
        startX.current = null;
        if (sx === null) return;
        const dx = e.clientX - sx;
        if (many && Math.abs(dx) > 50) {
          go(dx < 0 ? 1 : -1);
        } else if (Math.abs(dx) < 10 && e.target === e.currentTarget) {
          onClose(); // tap en el fondo (no en la foto ni en un botón)
        }
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={tCommon("close")}
        className="absolute right-4 top-4 z-10 flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
      >
        <CloseIcon className="size-6" />
      </button>

      <div
        className="relative h-[80vh] w-[92vw] max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={images[index]}
          alt={`Foto ${index + 1}`}
          fill
          sizes="92vw"
          className="object-contain"
          draggable={false}
          priority
        />
      </div>

      {many && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label={tCommon("previous")}
            className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeftIcon className="size-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label={tCommon("next")}
            className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeftIcon className="size-6 rotate-180" />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 backdrop-blur">
            {index + 1} / {images.length}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
