"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  type PhotoTransform,
  DEFAULT_PHOTO_TRANSFORM,
  photoTransformCss,
} from "@only-g/shared-types/artist-profile";
import { glassSurface, GlassSheen } from "@/components/ui/glass";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  CloseIcon,
  CheckIcon,
  CrosshairIcon,
  ImageIcon,
  MinusIcon,
  MonitorIcon,
  PlusIcon,
  RotateCwIcon,
  RotateCcwIcon,
  SmartphoneIcon,
  SpinnerIcon,
} from "@/components/icons";
import { StepButton, clampNum } from "./StepButton";
import { UploadButton } from "./UploadButton";

export type ScreenTarget = "desktop" | "mobile";

/**
 * Vista previa de la FOTO DE PERFIL en la OTRA resolución (§04).
 *
 * Deliberadamente NO renderiza el perfil entero: solo la foto dentro de un marco
 * con la proporción de esa pantalla. Lo que el artista necesita comprobar es el
 * ENCUADRE (una foto horizontal se convierte en franja en un móvil), no el resto
 * de la maqueta — que ya está viendo en el editor.
 *
 * Cada pantalla guarda su propio encuadre (`photoTransform` / `photoTransformMobile`)
 * porque el que funciona en 16:9 casi nunca funciona en 9:19.5.
 */
export function PhotoScreenPreview({
  open,
  target,
  url,
  transform,
  onTransformChange,
  onClose,
  onUploadOther,
  uploading = false,
  accent = "#a78bfa",
  justUploaded = false,
}: {
  open: boolean;
  /** Pantalla que se está previsualizando (la que NO estás usando). */
  target: ScreenTarget;
  url: string;
  transform: PhotoTransform;
  onTransformChange: (next: PhotoTransform) => void;
  onClose: () => void;
  /** Subir una imagen DISTINTA dedicada a esta pantalla. */
  onUploadOther: (files: File[]) => void;
  uploading?: boolean;
  accent?: string;
  /** Se abrió justo después de cambiar la foto → el copy invita a ajustarla. */
  justUploaded?: boolean;
}) {
  const t = useTranslations("profileBuilder.screenPreview");
  const [mounted, setMounted] = useState(false);
  // Arrastre (pan) de la foto dentro del marco.
  const [drag, setDrag] = useState<{
    sx: number;
    sy: number;
    bx: number;
    by: number;
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open || !url) return null;

  const isMobile = target === "mobile";
  const Icon = isMobile ? SmartphoneIcon : MonitorIcon;
  const patch = (p: Partial<PhotoTransform>) =>
    onTransformChange({ ...transform, ...p });

  const photo = (
    <>
      <Image
        src={url}
        alt={t("photoAlt")}
        fill
        sizes={isMobile ? "260px" : "(min-width: 640px) 40rem, 90vw"}
        className="object-cover"
        style={{
          transform: photoTransformCss(transform),
          transformOrigin: "center",
        }}
      />
      {/* Capa de arrastre: mover para reencuadrar sin salir de la vista previa. */}
      <div
        className="absolute inset-0 cursor-move touch-none"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setDrag({
            sx: e.clientX,
            sy: e.clientY,
            bx: transform.x,
            by: transform.y,
            w: r.width,
            h: r.height,
          });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          patch({
            x: drag.bx + ((e.clientX - drag.sx) / drag.w) * 100,
            y: drag.by + ((e.clientY - drag.sy) / drag.h) * 100,
          });
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      />
    </>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:p-6"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isMobile ? t("titleMobile") : t("titleDesktop")}
        className={`${glassSurface} my-auto w-full max-w-2xl rounded-3xl p-5 sm:p-6`}
      >
        <GlassSheen />
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="absolute top-0 right-0 flex size-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <CloseIcon className="size-5" />
          </button>

          <h2 className="font-narrow mb-1 flex items-center gap-2 pr-10 text-xl font-bold tracking-wide text-white uppercase">
            <Icon className="size-5" style={{ color: accent }} />
            {isMobile ? t("titleMobile") : t("titleDesktop")}
          </h2>
          <p className="text-silver-300 mb-5 text-sm">
            {justUploaded
              ? t("hintAfterUpload")
              : isMobile
                ? t("hintMobile")
                : t("hintDesktop")}
          </p>

          {/* Marco con la proporción REAL de la pantalla objetivo. Solo la foto:
              nada de nombre, botones ni secciones — aquí se juzga el encuadre. */}
          <div className="flex justify-center">
            {isMobile ? (
              <div className="relative w-[210px] shrink-0 rounded-[2.2rem] bg-black p-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/20 sm:w-[240px]">
                <div className="relative aspect-[9/19.5] w-full overflow-hidden rounded-[1.7rem] bg-neutral-950">
                  {photo}
                </div>
                {/* Isla/notch: ancla visual para que se lea como un teléfono. */}
                <span
                  aria-hidden="true"
                  className="absolute top-4 left-1/2 h-4 w-16 -translate-x-1/2 rounded-full bg-black"
                />
              </div>
            ) : (
              <div className="w-full max-w-lg">
                <div className="relative rounded-xl bg-black p-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/20">
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-950">
                    {photo}
                  </div>
                </div>
                {/* Pie del monitor. */}
                <div className="mx-auto h-3 w-24 rounded-b-md bg-white/15" />
                <div className="mx-auto h-1.5 w-40 rounded-full bg-white/15" />
              </div>
            )}
          </div>

          {/* Encuadre para ESTA pantalla (independiente de la otra). */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-[2px] text-white/55 uppercase">
                {t("zoom")}
              </span>
              <StepButton
                ariaLabel={t("zoomOut")}
                onStep={() =>
                  onTransformChange({
                    ...transform,
                    scale: clampNum(transform.scale - 0.1, 1, 3),
                  })
                }
              >
                <MinusIcon className="size-4" />
              </StepButton>
              <span className="w-11 text-center text-sm text-white tabular-nums">
                {transform.scale.toFixed(1)}×
              </span>
              <StepButton
                ariaLabel={t("zoomIn")}
                onStep={() =>
                  onTransformChange({
                    ...transform,
                    scale: clampNum(transform.scale + 0.1, 1, 3),
                  })
                }
              >
                <PlusIcon className="size-4" />
              </StepButton>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-[2px] text-white/55 uppercase">
                {t("rotate")}
              </span>
              <StepButton
                ariaLabel={t("rotateLeft")}
                onStep={() =>
                  onTransformChange({
                    ...transform,
                    rotation: clampNum(transform.rotation - 2, -180, 180),
                  })
                }
              >
                <RotateCcwIcon className="size-4" />
              </StepButton>
              <span className="w-11 text-center text-sm text-white tabular-nums">
                {Math.round(transform.rotation)}°
              </span>
              <StepButton
                ariaLabel={t("rotateRight")}
                onStep={() =>
                  onTransformChange({
                    ...transform,
                    rotation: clampNum(transform.rotation + 2, -180, 180),
                  })
                }
              >
                <RotateCwIcon className="size-4" />
              </StepButton>
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] tracking-[2px] text-white/45 uppercase">
            {t("dragHint")}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-4 sm:justify-end">
            <GlassButton
              onClick={() => onTransformChange(DEFAULT_PHOTO_TRANSFORM)}
            >
              <CrosshairIcon className="size-4" />
              {t("reset")}
            </GlassButton>
            <UploadButton
              glass
              accept="image/*"
              onFiles={onUploadOther}
              disabled={uploading}
            >
              {uploading ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <ImageIcon className="size-4" />
              )}
              {isMobile ? t("uploadVertical") : t("uploadHorizontal")}
            </UploadButton>
            <GlassButton onClick={onClose} className="!text-amethyst-200">
              <CheckIcon className="size-4" />
              {t("done")}
            </GlassButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
